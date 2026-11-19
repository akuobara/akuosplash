// Setup para probar el /sync DEPLOYADO: deja transtest3 con plan_id en DB + preapproval
// autorizada en MP (simulando que el usuario pagó). Después, el /sync deployado debe
// encontrarla por preapproval_plan_id y activar el plan.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");
  const api = "https://api.mercadopago.com";
  const u = (await db.execute(`SELECT id FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  const userId = u.id;
  const extRef = `akuo_sub:${userId}:premium:mensual`;

  // 1) Card token (tarjeta de test)
  const ct = await (await fetch(`${api}/v1/card_tokens`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_number: "5416752602582580", security_code: "123", expiration_month: 11, expiration_year: 2030, cardholder: { name: "APRO" } }),
  })).json();

  // 2) Plan
  const pl = await (await fetch(`${api}/preapproval_plan`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "AkuoSplash — Plan Premium (mensual)",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 7990, currency_id: "CLP" },
      external_reference: extRef,
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion&mp=ok",
    }),
  })).json();
  console.log("plan_id:", pl.id);

  // 3) Preapproval con card_token → MP autoriza (simula "usuario pagó")
  const pre = await (await fetch(`${api}/preapproval`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      preapproval_plan_id: pl.id, reason: "AkuoSplash — Plan Premium (mensual)",
      payer_email: "test_user_2094743021490827193@testuser.com", card_token_id: ct.id,
      external_reference: extRef, back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion&mp=ok",
    }),
  })).json();
  console.log("preapproval_id:", pre.id, "status:", pre.status, "monto: $", pre.auto_recurring?.transaction_amount);

  // 4) Guardar plan_id en transtest3 (como /create producción: plan_id, status pending, plan gratis)
  await db.execute({
    sql: `UPDATE AkuoUsuario SET mpSubPreapprovalId=?, mpSubPlanSolicitado='premium', mpSubCiclo='mensual', mpSubStatus='pending', mpSubAmount=7990, plan='gratis', suscripcionActiva=0, mpSubAutorizadoEn=NULL, planActivoDesde=NULL, planActivoHasta=NULL WHERE id=?`,
    args: [pl.id, userId],
  });
  const chk = (await db.execute(`SELECT plan, mpSubStatus, mpSubPreapprovalId FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\ntranstest3 lista para /sync:");
  console.log("  DB:", JSON.stringify(chk));
  console.log("  MP tiene preapproval", pre.id, "authorized contra el plan", pl.id);
  console.log("\n→ Cuando el deploy termine, GET /api/akuosplash/subscription/mercadopago/sync como transtest3");
  console.log("  debe encontrar la preapproval por preapproval_plan_id y activar plan=premium.");
})().catch(e => console.error("ERR", e.message));
