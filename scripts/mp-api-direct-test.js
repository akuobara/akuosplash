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

  // 1) Fechas de creación de los 3 usuarios clave
  for (const [label, uid] of [["collector (TESTUSER8470...)", 3738974993], ["payer exitoso 9/11 (TESTUSER5223...)", 3774264414], ["test user nuevo (ayer)", 3848302154]]) {
    const r = await fetch(`https://api.mercadopago.com/users/${uid}`, { headers: { Authorization: `Bearer ${DB_TOKEN}` } });
    const u = await r.json();
    console.log(`${label} [${uid}]: HTTP ${r.status} nickname=${u.nickname} creado=${u.date_created ?? u.registration_date ?? "?"} site=${u.site_id}`);
  }

  // 2) Crear CARD TOKEN con la public key (flujo de la tarjeta de prueba master)
  console.log(`\n=== crear card_token (pk: ${ENV_PK.slice(0, 16)}...) ===`);
  const ctr = await fetch("https://api.mercadopago.com/v1/card_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_PK}`, "Content-Type": "application/json", "x-test-token": "true" },
    body: JSON.stringify({
      card_number: "5416752602582580",
      security_code: "123",
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: "APRO", identification: { type: "OTRO", number: "123456789" } },
    }),
  });
  const ct = await ctr.json();
  console.log(`card_token: HTTP ${ctr.status} id=${ct.id ?? "-"} status=${ct.status ?? "-"} err=${ct.error ? JSON.stringify(ct).slice(0,200) : "-"}`);
  if (!ctr.ok) return;

  // 3) Crear PREAPPROVAL contra el PLAN de transtest3 (0e6bfcec) con card_token, payer = test user nuevo
  const preBody = {
    preapproval_plan_id: "0e6bfcec44fc48aa81c1e33e099d87fa",
    reason: "AkuoSplash — Plan test (mensual)",
    payer_email: "test_user_5921243736691050007@testuser.com",
    card_token_id: ct.id,
    external_reference: "akuo_sub:API_TEST:test:mensual",
    back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
  };
  console.log(`\n=== POST /preapproval (plan + card_token, token DB app 5399) ===`);
  const pr = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${DB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(preBody),
  });
  const pd = await pr.json();
  console.log(`HTTP ${pr.status}`);
  console.log(JSON.stringify({ id: pd.id, status: pd.status, application_id: pd.application_id, payer_id: pd.payer_id, payment_method_id: pd.payment_method_id, card_id: pd.card_id, init_point: (pd.init_point||"").slice(0,80), next_payment_date: pd.next_payment_date, summarized: pd.summarized, error: pd.error ?? pd.message ?? null }, null, 1));

  // Si falló con el token DB, probar con el ENV (app 2731)
  if (!pr.ok) {
    console.log(`\n=== reintentar con token ENV (app 2731) ===`);
    const pr2 = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(preBody),
    });
    const pd2 = await pr2.json();
    console.log(`HTTP ${pr2.status}`);
    console.log(JSON.stringify({ id: pd2.id, status: pd2.status, application_id: pd2.application_id, error: pd2.error ?? pd2.message ?? null }).slice(0, 400));
  }
})().catch(e => console.error("ERROR:", e.message));
