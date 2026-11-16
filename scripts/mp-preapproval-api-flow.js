const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

const EMAIL = "test_user_2094743021490827193@testuser.com"; // test user de transtest3

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken);

  // 1) Card token (con access token — funciona)
  const ctr = await fetch("https://api.mercadopago.com/v1/card_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: "5416752602582580",
      security_code: "123",
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: "APRO" },
    }),
  });
  const ct = await ctr.json();
  console.log(`card_token: HTTP ${ctr.status} id=${ct.id}`);
  if (!ctr.ok) return;

  // 2) Preapproval contra el PLAN de transtest3 con card_token (token DB, app 5399)
  console.log(`\n=== preapproval contra plan 0e6bfcec (token DB app 5399) ===`);
  const pr = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      preapproval_plan_id: "0e6bfcec44fc48aa81c1e33e099d87fa",
      reason: "AkuoSplash — Plan test (mensual)",
      payer_email: EMAIL,
      card_token_id: ct.id,
      external_reference: "akuo_sub:API_FLOW:test:mensual",
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    }),
  });
  const pd = await pr.json();
  console.log(`HTTP ${pr.status}`);
  console.log(JSON.stringify({ id: pd.id, status: pd.status, app: pd.application_id, payer_id: pd.payer_id, payment_method_id: pd.payment_method_id, card_id: pd.card_id, next_payment_date: pd.next_payment_date, summarized: pd.summarized, error: pd.error ?? pd.message ?? null }, null, 1));
  fs.writeFileSync("/home/z/my-project/scripts/mp-api-preapproval-result.json", JSON.stringify(pd, null, 2));

  // 3) Si quedó pending, esperar 10s y consultar estado (MP cobra la validación asincrónicamente)
  if (pd.id) {
    console.log("\n(esperando 12s para ver si MP cobra la validación...)");
    await new Promise(r => setTimeout(r, 12000));
    const gr = await fetch(`https://api.mercadopago.com/preapproval/${pd.id}`, { headers: { Authorization: `Bearer ${TOK}` } });
    const gd = await gr.json();
    console.log(`estado tras 12s: ${gd.status}  next_payment_date=${gd.next_payment_date}`);
    console.log(`summarized: ${JSON.stringify(gd.summarized)}`);
  }
})().catch(e => console.error("ERROR:", e.message));
