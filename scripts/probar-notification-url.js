// Prueba si MP acepta notification_url en preapproval_plan y dispara el webhook.
// Si funciona → no hace falta registrar nada en el panel.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const WEBHOOK_URL = "https://akuosplash.cl/api/akuosplash/subscription/mercadopago/webhook";

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");
  const api = "https://api.mercadopago.com";
  const u = (await db.execute(`SELECT id FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  const userId = u.id;

  const ct = await (await fetch(`${api}/v1/card_tokens`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_number: "5416752602582580", security_code: "123", expiration_month: 11, expiration_year: 2030, cardholder: { name: "APRO" } }),
  })).json();

  // Plan CON notification_url (campo de prueba)
  const pl = await (await fetch(`${api}/preapproval_plan`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "AkuoSplash — Plan Premium (mensual) [TEST notif_url]",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 7990, currency_id: "CLP" },
      external_reference: `akuo_sub:${userId}:premium:mensual`,
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
      notification_url: WEBHOOK_URL,
    }),
  })).json();
  console.log("plan (con notification_url):", pl.id, "| aceptó notification_url?:", pl.notification_url ? "SÍ → " + pl.notification_url : "NO (lo ignoró)");

  const pre = await (await fetch(`${api}/preapproval`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      preapproval_plan_id: pl.id, reason: "AkuoSplash — Plan Premium (mensual) [TEST notif_url]",
      payer_email: "test_user_2094743021490827193@testuser.com", card_token_id: ct.id,
      external_reference: `akuo_sub:${userId}:premium:mensual`,
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
      notification_url: WEBHOOK_URL,
    }),
  })).json();
  console.log("preapproval:", pre.id, "status:", pre.status, "| notification_url:", pre.notification_url || "(ninguna)");

  console.log("\nEsperando 20s a ver si el webhook llega...");
  for (let i = 5; i <= 20; i += 5) {
    await sleep(5000);
    const chk = (await db.execute(`SELECT plan, mpSubStatus FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
    console.log(`  +${i}s: plan=${chk.plan} mpSubStatus=${chk.mpSubStatus}`);
    if (chk.plan === "premium") { console.log("✓ WEBHOOK LLEGÓ via notification_url"); break; }
  }
  const fin = (await db.execute(`SELECT plan, mpSubStatus FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\nFINAL:", JSON.stringify(fin));
  console.log(fin.plan === "premium" ? "✓ notification_url FUNCIONA — no hace falta panel" : "✗ notification_url no dispara webhook — hay que registrar en panel");
})().catch(e => console.error("ERR", e.message));
