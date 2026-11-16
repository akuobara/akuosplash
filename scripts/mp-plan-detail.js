const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken);

  // Plan completo de transtest3 (el del intento actual)
  const pr = await fetch("https://api.mercadopago.com/preapproval_plan/0e6bfcec44fc48aa81c1e33e099d87fa", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const plan = await pr.json();
  console.log("=== PLAN ACTUAL (0e6bfcec, intento de hoy) ===");
  console.log(JSON.stringify(plan, null, 1).slice(0, 2000));

  // mpTestUserEmail de transtest3 en la DB
  const ru = await db.execute(`SELECT id, email, mpTestUserEmail FROM AkuoUsuario WHERE email = 'transtest3@akuosplash.test'`);
  console.log("\n=== transtest3 en DB ===");
  for (const row of ru.rows) console.log(`id=${row.id} email=${row.email} mpTestUserEmail=${row.mpTestUserEmail}`);

  // El plan del 9/11 que "funcionó" (fue preapproval directo, pero veamos si hay plan asociado)
  const pr2 = await fetch("https://api.mercadopago.com/preapproval_plan/search?limit=30&sort=date_created&criteria=desc", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const pd = await pr2.json();
  const plans = (pd.results || pd.elements || []).filter(p => (p.date_created || "").startsWith("2026-11-09"));
  console.log(`\n=== PLANES del 9/11 (${plans.length}) ===`);
  for (const p of plans) {
    console.log(`plan=${p.id} creado=${p.date_created} reason=${(p.reason||"").slice(0,40)}`);
    console.log(`  payer_email=${JSON.stringify(p.payer_email)}  status=${p.status}  init_point=${(p.init_point||"").slice(0,80)}`);
  }
})().catch(e => console.error("ERROR:", e.message));
