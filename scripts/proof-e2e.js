// Verificación E2E con output COMPLETO y crudo — para que el usuario vea la respuesta real.
// Muestra: (1) HTTP response de la app, (2) respuesta de MERCADOPAGO consultando su API,
// (3) estado en la DB. Nada de "✅ funciona" sin la evidencia cruda.

const fs = require("fs");

const BASE = "https://akuosplash.cl";
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };

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
  console.log(" VERIFICACIÓN E2E CONTRA APP EN VIVO (akuosplash.cl)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 0) Reset del usuario para test limpio
  const { createClient } = require("@libsql/client");
  const db = createClient({
    url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
    authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
  });
  await db.execute(`UPDATE AkuoUsuario SET mpSubStatus=NULL, mpSubPreapprovalId=NULL,
    mpSubPlanSolicitado=NULL, suscripcionActiva=0, planActivoHasta=NULL, mpSubIniciadoEn=NULL
    WHERE email='transtest3@akuosplash.test'`);
  console.log("[reset] transtest3 → subscripción limpia (pending)\n");

  // 1) Login
  const session = await login("transtest3@akuosplash.test", "Test1234!");
  if (!session) { console.log("✗ login falló"); return; }
  console.log("[login] transtest3 OK\n");

  // 2) Llamar al endpoint create (lo mismo que dispara el botón "Pagar suscripción")
  console.log("─── PASO 1: POST /api/akuosplash/subscription/mercadopago/create ───");
  console.log("(esto es lo que ejecuta el botón 'Pagar suscripción' en la app)\n");

  const createRes = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ planId: "test", ciclo: "mensual" }),
  });

  const createBody = await createRes.json();
  console.log("HTTP status:", createRes.status);
  console.log("Respuesta cruda de la APP:");
  console.log(JSON.stringify(createBody, null, 2));
  console.log("");

  if (!createBody.preapprovalId) {
    console.log("✗ la app no devolvió preapprovalId — el flujo falló");
    return;
  }

  // 3) Consultar MERCADOPAGO directamente (su API, no la nuestra)
  console.log("─── PASO 2: GET https://api.mercadopago.com/preapproval/<id> ───");
  console.log("(consultando directamente a MercadoPago, NO a nuestra app)\n");

  const TOK = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
  const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${createBody.preapprovalId}`, {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const mpBody = await mpRes.json();

  console.log("HTTP status de MP:", mpRes.status);
  console.log("Respuesta cruda de MERCADOPAGO (campos clave):");
  console.log(JSON.stringify({
    id: mpBody.id,
    status: mpBody.status,
    collector_id: mpBody.collector_id,
    payer_id: mpBody.payer_id,
    payer_email: mpBody.payer_email,
    reason: mpBody.reason,
    external_reference: mpBody.external_reference,
    auto_recurring: mpBody.auto_recurring,
    card_id: mpBody.card_id,
    summarized: mpBody.summarized,
    next_payment_date: mpBody.next_payment_date,
    date_created: mpBody.date_created,
    last_modified: mpBody.last_modified,
  }, null, 2));
  console.log("");

  // 4) Estado en la DB
  console.log("─── PASO 3: estado en la base de datos (tabla AkuoUsuario) ───\n");
  const ur = await db.execute(`SELECT email, plan, mpSubStatus, mpSubPreapprovalId,
    suscripcionActiva, planActivoHasta, mpSubAmount FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`);
  const u = ur.rows[0];
  console.log("DB transtest3:");
  console.log(JSON.stringify({
    email: u.email,
    plan: u.plan,
    mpSubStatus: u.mpSubStatus,
    mpSubPreapprovalId: u.mpSubPreapprovalId,
    suscripcionActiva: u.suscripcionActiva,
    planActivoHasta: u.planActivoHasta,
    mpSubAmount: u.mpSubAmount,
  }, null, 2));
  console.log("");

  // 5) Veredicto basado en MERCADOPAGO (no en nuestra app)
  const mpAuthorized = mpBody.status === "authorized" && mpBody.summarized?.charged_quantity >= 1;
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(" VEREDICTO (según MercadoPago, no según nosotros):");
  console.log("  MP status:", mpBody.status);
  console.log("  MP cobros realizados:", mpBody.summarized?.charged_quantity);
  console.log("  MP monto cobrado:", mpBody.summarized?.charged_amount || mpBody.auto_recurring?.transaction_amount, "CLP");
  console.log("  MP próximo cobro:", mpBody.next_payment_date);
  console.log("  DB plan activo:", u.suscripcionActiva === 1 ? "SÍ" : "NO");
  console.log("  DB activo hasta:", u.planActivoHasta);
  console.log(mpAuthorized ? "  → MERCADOPAGO CONFIRMA: subscripción autorizada y cobrada" : "  → MP NO confirma");
  console.log("═══════════════════════════════════════════════════════════════");
})().catch(e => console.error("ERR", e.message));
