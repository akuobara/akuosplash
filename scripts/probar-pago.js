// PROBAR PAGO — lo corres TÚ y ves la respuesta cruda de MercadoPago (no la de la app).
//
// Uso:
//   node scripts/probar-pago.js premium     ← paga Plan Premium ($7.990)
//   node scripts/probar-pago.js pro         ← paga Plan Pro ($23.990)
//
// Qué hace:
// 1) Muestra el estado ANTES (transtest3 limpio + 0 preapprovals vivas en MP)
// 2) Paga el plan que elegiste (login transtest3 → POST /create)
// 3) Consulta DIRECTAMENTE a https://api.mercadopago.com/preapproval/<id> y te muestra
//    la respuesta cruda: status, monto, cobros hechos, total cobrado, razón.
// 4) Cuenta cuántas preapprovals VIVAS hay en toda la cuenta MP (debe ser 1).

const fs = require("fs");
const { createClient } = require("@libsql/client");

const BASE = "https://akuosplash.cl";
const PLAN = process.argv[2] || "premium";
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

(async () => {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  PROBAR PAGO — plan ${PLAN.toUpperCase()} — evidencia cruda de MP`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");

  // ── 1) ESTADO ANTES ──
  const antes = (await db.execute(`SELECT plan, suscripcionActiva, mpSubStatus, mpSubPreapprovalId FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("── ANTES ──");
  console.log("  DB transtest3:", JSON.stringify(antes));

  let vivasAntes = [];
  for (let off = 0; off < 500; off += 100) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=100&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    vivasAntes = vivasAntes.concat(res.filter(p => p.status === "authorized" || p.status === "pending"));
    if (res.length < 100) break;
  }
  console.log(`  Preapprovals vivas en MP: ${vivasAntes.length}\n`);

  // ── 2) LOGIN + PAGO ──
  const session = await login("transtest3@akuosplash.test", "Test1234!");
  if (!session) { console.log("✗ login falló"); return; }
  console.log("── PAGO ──");
  console.log(`  POST /api/akuosplash/subscription/mercadopago/create  body={plan:"${PLAN}",ciclo:"mensual"}\n`);

  const payRes = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ plan: PLAN, ciclo: "mensual" }),
  });
  const payBody = await payRes.json();
  console.log("  HTTP:", payRes.status);
  console.log("  Respuesta de la app:", JSON.stringify(payBody, null, 2), "\n");
  if (!payBody.preapprovalId) { console.log("✗ la app no devolvió preapprovalId"); return; }

  // ── 3) RESPUESTA CRUDA DE MERCADOPAGO ──
  console.log("── RESPUESTA CRUDA DE MERCADOPAGO (GET /preapproval/<id>) ──");
  const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${payBody.preapprovalId}`, {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const mpBody = await mpRes.json();
  console.log("  HTTP de MP:", mpRes.status);
  console.log("  ", JSON.stringify({
    id: mpBody.id,
    status: mpBody.status,
    reason: mpBody.reason,
    monto: mpBody.auto_recurring?.transaction_amount,
    moneda: mpBody.auto_recurring?.currency_id,
    frecuencia: `${mpBody.auto_recurring?.frequency} ${mpBody.auto_recurring?.frequency_type}`,
    cobros_hechos: mpBody.summarized?.charged_quantity,
    total_cobrado: mpBody.summarized?.charged_amount,
    payer: mpBody.payer_email,
    external_reference: mpBody.external_reference,
    proximo_cobro: mpBody.auto_recurring?.end_date,
  }, null, 2), "\n");

  // ── 4) ESTADO DESPUÉS ──
  const despues = (await db.execute(`SELECT plan, mpSubStatus, mpSubAmount, suscripcionActiva, mpSubPreapprovalId FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("── DESPUÉS ──");
  console.log("  DB transtest3:", JSON.stringify(despues));

  let vivasDespues = [];
  for (let off = 0; off < 500; off += 100) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=100&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    vivasDespues = vivasDespues.concat(res.filter(p => p.status === "authorized" || p.status === "pending"));
    if (res.length < 100) break;
  }
  console.log(`  Preapprovals vivas en MP: ${vivasDespues.length}`);
  for (const p of vivasDespues) {
    console.log(`    ${p.id}  ${p.status}  $${p.auto_recurring?.transaction_amount}  ${(p.external_reference || "").slice(0, 50)}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Esto es lo que MercadoPago le responde a la app. No es lo que yo digo.");
  console.log("═══════════════════════════════════════════════════════════════");
})().catch(e => console.error("ERR", e.message));
