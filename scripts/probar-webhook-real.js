// PRUEBA WEBHOOK REAL — crea la preapproval directo por la API de MP (SIN /create).
// Así el backdoor de /create NO corre. MP autoriza (tarjeta de test, $0 reales) y
// dispara el webhook. Si el plan se activa, fue el webhook. Si no, bug encontrado.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");
  const api = "https://api.mercadopago.com";

  // transtest3 id
  const u = (await db.execute(`SELECT id, plan, mpSubStatus FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("transtest3 ANTES:", JSON.stringify(u));
  const userId = u.id;

  // 1) Card token (tarjeta de test Mastercard CL)
  const ct = await (await fetch(`${api}/v1/card_tokens`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_number: "5416752602582580", security_code: "123", expiration_month: 11, expiration_year: 2030, cardholder: { name: "APRO" } }),
  })).json();
  if (!ct.id) { console.log("✗ card_token falló:", ct); return; }
  console.log("card_token:", ct.id);

  // 2) Plan (preapproval_plan)
  const planBody = {
    reason: "AkuoSplash — Plan Premium (mensual) [TEST WEBHOOK]",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 7990, currency_id: "CLP" },
    external_reference: `akuo_sub:${userId}:premium:mensual`,
    back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
  };
  const pl = await (await fetch(`${api}/preapproval_plan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(planBody),
  })).json();
  if (!pl.id) { console.log("✗ plan falló:", pl); return; }
  console.log("plan_id:", pl.id);

  // 3) Preapproval contra el plan con el card_token — MP autoriza y cobra al instante
  const pre = await (await fetch(`${api}/preapproval`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      preapproval_plan_id: pl.id,
      reason: planBody.reason,
      payer_email: "test_user_2094743021490827193@testuser.com",
      card_token_id: ct.id,
      external_reference: planBody.external_reference,
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    }),
  })).json();
  console.log("\nRespuesta MP preapproval:");
  console.log(JSON.stringify({
    id: pre.id, status: pre.status,
    monto: pre.auto_recurring?.transaction_amount,
    cobros: pre.summarized?.charged_quantity,
    total: pre.summarized?.charged_amount,
    ext_ref: pre.external_reference,
  }, null, 2));
  if (!pre.id) { console.log("✗ preapproval falló"); return; }

  // 4) NO llamamos a /create. Esperamos a que MP dispare el webhook.
  console.log("\nEsperando 15s a que MP dispare el webhook (subscription_preapproval)...");
  for (let i = 5; i <= 15; i += 5) {
    await sleep(5000);
    const chk = (await db.execute(`SELECT plan, mpSubStatus, mpSubPreapprovalId, suscripcionActiva, mpSubAutorizadoEn FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
    console.log(`  +${i}s: plan=${chk.plan} mpSubStatus=${chk.mpSubStatus} suscripcionActiva=${chk.suscripcionActiva} autorizadoEn=${chk.mpSubAutorizadoEn || "—"}`);
    if (chk.plan === "premium") break;
  }

  const fin = (await db.execute(`SELECT plan, mpSubStatus, mpSubPreapprovalId, suscripcionActiva, mpSubAutorizadoEn, planActivoHasta FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\ntranstest3 DESPUÉS:", JSON.stringify(fin));
  console.log("\n════ VEREDICTO ════");
  if (fin.plan === "premium" && fin.suscripcionActiva == 1) {
    console.log("✓ El WEBHOOK activó el plan (no llamamos /create). Flujo de producción funciona.");
  } else if (fin.mpSubStatus === null) {
    console.log("✗ El webhook NO llegó. MP no disparó notification — bug: webhook no registrado en MP.");
  } else {
    console.log("⚠ Estado intermedio. mpSubStatus=" + fin.mpSubStatus + " pero plan=" + fin.plan);
  }
})().catch(e => console.error("ERR", e.message));
