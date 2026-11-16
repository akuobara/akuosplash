const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const ENV_PK = grab(/"key":\s*"AKUO_MP_PUBLIC_KEY"[^}]*?"value":\s*"([^"]+)"/);
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const DB_TOKEN = String(rc.rows[0].mpSubAccessToken);
  const TOK = DB_TOKEN; // el que usa producción

  // 1) Crear Customer con el email del test user (flujo documentado por MP para tests)
  const email = "test_user_2094743021490827193@testuser.com"; // test user de transtest3
  console.log(`=== 1) Customer para ${email} (token DB app 5399) ===`);
  const cr = await fetch("https://api.mercadopago.com/v1/customers", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const cd = await cr.json();
  console.log(`HTTP ${cr.status} customer_id=${cd.id ?? "-"}`);
  if (!cr.ok) console.log("err:", JSON.stringify(cd).slice(0, 300));

  // Si el customer ya existe, obtenerlo
  let customerId = cd.id;
  if (!customerId) {
    const gr = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const gd = await gr.json();
    const res = gd.results || [];
    customerId = res[0]?.id;
    console.log(`search: HTTP ${gr.status} → ${customerId ?? "(no existe)"}`);
  }

  // 2) Card token con la PUBLIC KEY y header x-test-token (método para tokenizar tarjetas de prueba)
  console.log(`\n=== 2) Card token (pk ${ENV_PK.slice(0, 14)}..., master de prueba, x-test-token) ===`);
  const ctr = await fetch("https://api.mercadopago.com/v1/card_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_PK}`, "Content-Type": "application/json", "x-test-token": "true" },
    body: JSON.stringify({
      card_number: "5416752602582580",
      security_code: "123",
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: "APRO", identification: { type: "Otro", number: "123456789" } },
    }),
  });
  const ct = await ctr.json();
  console.log(`HTTP ${ctr.status} card_token=${ct.id ?? "-"} ${ct.error ? "err: " + JSON.stringify(ct).slice(0, 200) : ""}`);
  if (!ctr.ok) return;

  // 3) Asociar la card al customer
  if (customerId) {
    console.log(`\n=== 3) Asociar card al customer ${customerId} ===`);
    const car = await fetch(`https://api.mercadopago.com/v1/customers/${customerId}/cards`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token: ct.id }),
    });
    const cad = await car.json();
    console.log(`HTTP ${car.status} card_id=${cad.id ?? "-"} method=${cad.payment_method?.id ?? "-"}`);
    if (!car.ok) console.log("err:", JSON.stringify(cad).slice(0, 300));
  }

  // 4) Crear preapproval con card_token
  console.log(`\n=== 4) Preapproval con card_token (plan de transtest3) ===`);
  const pr = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      preapproval_plan_id: "0e6bfcec44fc48aa81c1e33e099d87fa",
      reason: "AkuoSplash — Plan test (mensual)",
      payer_email: email,
      card_token_id: ct.id,
      external_reference: "akuo_sub:API_FLOW:test:mensual",
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    }),
  });
  const pd = await pr.json();
  console.log(`HTTP ${pr.status}`);
  console.log(JSON.stringify({ id: pd.id, status: pd.status, app: pd.application_id, payer_id: pd.payer_id, payment_method_id: pd.payment_method_id, card_id: pd.card_id, init_point: (pd.init_point || "").slice(0, 80), next_payment_date: pd.next_payment_date, error: pd.error ?? pd.message ?? null }, null, 1));
})().catch(e => console.error("ERROR:", e.message));
