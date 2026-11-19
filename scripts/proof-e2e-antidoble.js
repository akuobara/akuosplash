// E2E DEFINITIVO con evidencia cruda — valida el fix anti-doble-cobro en vivo:
// 1) transtest3 paga plan PREMIUM ($7.990) → evidencia cruda de MP (status, cobros, monto)
// 2) Verificación DB: plan=premium, monto=$7.990 (el plan CORRECTO al precio CORRECTO)
// 3) Paga OTRA VEZ plan PRO ($23.990) → el fix debe CANCELAR la preapproval premium anterior
// 4) Verificación MP: la premium CANCELLED, la pro AUTHORIZED, y SOLO 1 viva en toda la cuenta
// Uso: node scripts/proof-e2e-antidoble.js

const fs = require("fs");
const { createClient } = require("@libsql/client");

const BASE = "https://akuosplash.cl";
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

async function login(email, password) {
  const res = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/akuosplash_session=([^;]+)/);
  return match ? match[1] : null;
}

async function pay(session, plan) {
  const res = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ plan, ciclo: "mensual" }),
  });
  return { status: res.status, body: await res.json() };
}

async function mpPreapproval(TOK, id) {
  const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  return r.json();
}

(async () => {
  console.log("═════════════════════════════════════════════════════════════");
  console.log(" E2E ANTI-DOBLE-COBRO — akuosplash.cl en vivo");
  console.log("═════════════════════════════════════════════════════════════\n");

  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");

  // 0) Reset transtest3
  await db.execute(`UPDATE AkuoUsuario SET mpSubStatus=NULL, mpSubPreapprovalId=NULL,
    mpSubPlanSolicitado=NULL, suscripcionActiva=0, planActivoHasta=NULL, mpSubIniciadoEn=NULL,
    plan='gratis', mpSubAmount=NULL, mpSubAutorizadoEn=NULL
    WHERE email='transtest3@akuosplash.test'`);
  console.log("[reset] transtest3 → plan gratis, sin subscripción\n");

  // 1) Login
  const session = await login("transtest3@akuosplash.test", "Test1234!");
  if (!session) { console.log("✗ login falló"); return; }
  console.log("[login] transtest3 OK\n");

  // ── PRIMER PAGO: PREMIUM ─────────────────────────────────────
  console.log("─── PASO 1: pagar plan PREMIUM ($7.990) ───");
  const p1 = await pay(session, "premium");
  console.log("HTTP:", p1.status);
  console.log("Respuesta de la app:", JSON.stringify(p1.body, null, 2), "\n");
  if (!p1.body.preapprovalId) { console.log("✗ falló el primer pago"); return; }
  const pre1 = p1.body.preapprovalId;

  // Evidencia cruda de MP
  const mp1 = await mpPreapproval(TOK, pre1);
  console.log("MERCADOPAGO dice (preapproval premium):");
  console.log(JSON.stringify({
    id: mp1.id, status: mp1.status, monto: mp1.auto_recurring?.transaction_amount,
    frecuencia: `${mp1.auto_recurring?.frequency} ${mp1.auto_recurring?.frequency_type}`,
    cobros_hechos: mp1.summarized?.charged_quantity, total_cobrado: mp1.summarized?.charged_amount,
    razon: mp1.reason,
  }, null, 2), "\n");

  // DB
  const u1 = (await db.execute(`SELECT plan, mpSubStatus, mpSubAmount, suscripcionActiva
    FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("DB transtest3:", JSON.stringify({
    plan: u1.plan, mpSubStatus: u1.mpSubStatus, mpSubAmount: u1.mpSubAmount, suscripcionActiva: u1.suscripcionActiva,
  }), "\n");
  console.log(u1.plan === "premium" && u1.mpSubAmount === 7990
    ? "✓ PASO 1 OK: plan premium al precio correcto ($7.990)"
    : `✗ PASO 1 FALLO: esperaba premium/$7990, got ${u1.plan}/${u1.mpSubAmount}`, "\n");

  // ── SEGUNDO PAGO: PRO (acá se valida el anti-doble-cobro) ────
  console.log("─── PASO 2: pagar plan PRO ($23.990) — el fix debe cancelar la premium anterior ───");
  const p2 = await pay(session, "pro");
  console.log("HTTP:", p2.status);
  console.log("Respuesta de la app:", JSON.stringify(p2.body, null, 2), "\n");
  if (!p2.body.preapprovalId) { console.log("✗ falló el segundo pago"); return; }
  const pre2 = p2.body.preapprovalId;

  // Evidencia cruda de MP para AMBAS preapprovals
  const mp2n = await mpPreapproval(TOK, pre2);
  const mp1n = await mpPreapproval(TOK, pre1); // re-consultar la primera
  console.log("MERCADOPAGO dice:");
  console.log("  premium (" + pre1 + "):");
  console.log("   ", JSON.stringify({ status: mp1n.status, cobros: mp1n.summarized?.charged_quantity }));
  console.log("  pro     (" + pre2 + "):");
  console.log("   ", JSON.stringify({ status: mp2n.status, cobros: mp2n.summarized?.charged_quantity, monto: mp2n.auto_recurring?.transaction_amount }), "\n");

  // ¿Cuántas preapprovals VIVAS hay en TODA la cuenta?
  let vivas = [];
  for (let off = 0; off < 500; off += 100) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=100&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    vivas = vivas.concat(res.filter(p => p.status === "authorized" || p.status === "pending"));
    if (res.length < 100) break;
  }
  console.log(`Preapprovals VIVAS en toda la cuenta MP: ${vivas.length}`);
  for (const p of vivas) {
    console.log(`   ${p.id}  ${p.status}  $${p.auto_recurring?.transaction_amount}  ${(p.external_reference || "").slice(0, 50)}`);
  }

  // DB final
  const u2 = (await db.execute(`SELECT plan, mpSubStatus, mpSubAmount, mpSubPreapprovalId, suscripcionActiva
    FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\nDB transtest3 final:", JSON.stringify({
    plan: u2.plan, mpSubStatus: u2.mpSubStatus, mpSubAmount: u2.mpSubAmount, activa: u2.suscripcionActiva,
  }), "\n");

  console.log("═════════════════════════════════════════════════════════════");
  console.log(" VEREDICTO (según la API de MercadoPago, no según la app):");
  const ok1 = mp1n.status === "cancelled";
  const ok2 = mp2n.status === "authorized" && mp2n.summarized?.charged_quantity >= 1;
  const ok3 = vivas.length === 1 && vivas[0]?.id === pre2;
  const ok4 = u2.plan === "pro" && u2.mpSubAmount === 23990 && u2.mpSubPreapprovalId === pre2;
  console.log(`  ${ok1 ? "✓" : "✗"} preapproval premium anterior: ${mp1n.status} (debía ser cancelled)`);
  console.log(`  ${ok2 ? "✓" : "✗"} preapproval pro nueva: ${mp2n.status}, cobros=${mp2n.summarized?.charged_quantity} (debía ser authorized con ≥1 cobro)`);
  console.log(`  ${ok3 ? "✓" : "✗"} total vivas en la cuenta: ${vivas.length} (debía ser EXACTAMENTE 1, la pro)`);
  console.log(`  ${ok4 ? "✓" : "✗"} DB: plan=${u2.plan} monto=${u2.mpSubAmount} preapproval=la pro`);
  console.log(ok1 && ok2 && ok3 && ok4
    ? "  → TODO OK: un usuario = una subscripción viva. No hay doble cobro posible."
    : "  → HAY ALGO MAL — revisar arriba");
  console.log("═════════════════════════════════════════════════════════════");
})().catch(e => console.error("ERR", e.message));
