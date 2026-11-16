const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const DB_TOKEN = String(rc.rows[0].mpSubAccessToken);

  // 1) Listar TODOS los test users de la cuenta collector (con cada token por si difieren)
  const seen = new Set();
  for (const [name, tok] of [["DB", DB_TOKEN], ["ENV", ENV_TOKEN]]) {
    const r = await fetch("https://api.mercadopago.com/users/test_user", { headers: { Authorization: `Bearer ${tok}` } });
    const d = await r.json().catch(() => ({}));
    console.log(`=== test users (${name} token) HTTP ${r.status} ===`);
    const list = Array.isArray(d) ? d : (d.results || d.users || []);
    for (const u of list) {
      const key = `${u.id}|${u.email}`;
      console.log(`  id=${u.id} email=${u.email} nickname=${u.nickname || "-"}`);
      seen.add(key);
    }
    if (!Array.isArray(d) && !d.results && !d.users) console.log("  raw:", JSON.stringify(d).slice(0, 300));
  }
  console.log(`\ntotal test users distintos: ${seen.size}`);

  // 2) Crear un PLAN con el token ENV (app del 9/11) para test A/B
  const body = {
    reason: "AkuoSplash — Plan test (mensual) [TEST-ENV-APP]",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 8000, currency_id: "CLP" },
    back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    external_reference: "akuo_sub:AB_TEST_ENV_APP:test:mensual",
  };
  const pr = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const plan = await pr.json();
  console.log(`\n=== PLAN creado con token ENV (app 2731961034891399) HTTP ${pr.status} ===`);
  if (pr.ok) {
    console.log(`plan_id: ${plan.id}`);
    console.log(`init_point: ${plan.init_point}`);
    fs.writeFileSync("/home/z/my-project/scripts/mp-env-plan.json", JSON.stringify({ planId: plan.id, initPoint: plan.init_point }, null, 2));
  } else {
    console.log("error:", JSON.stringify(plan).slice(0, 400));
  }

  // 3) Crear el mismo PLAN con el token DB para comparación inmediata
  const pr2 = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${DB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, reason: "AkuoSplash — Plan test (mensual) [TEST-DB-APP]" }),
  });
  const plan2 = await pr2.json();
  console.log(`\n=== PLAN con token DB (app 5399283377747748) HTTP ${pr2.status} ===`);
  console.log(pr2.ok ? `plan_id: ${plan2.id}\ninit_point: ${plan2.init_point}` : `error: ${JSON.stringify(plan2).slice(0, 300)}`);
})().catch(e => console.error("ERROR:", e.message));
