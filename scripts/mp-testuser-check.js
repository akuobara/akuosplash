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

  // 1) ¿Quién es el payer exitoso del 9/11 (3774264414)?
  const r1 = await fetch("https://api.mercadopago.com/users/3774264414", { headers: { Authorization: `Bearer ${TOK}` } }).catch(() => null);
  if (r1) {
    const u = await r1.json().catch(() => ({}));
    console.log(`payer 9/11 (3774264414): nickname=${u.nickname} email=${u.email} site=${u.site_id} ${JSON.stringify(u).slice(0,150)}`);
  }

  // 2) ¿Quién es el test user de transtest3 (test_user_2094743021490827193)?
  // El id numérico está en el email: 2094743021490827193
  const r2 = await fetch("https://api.mercadopago.com/users/2094743021490827193", { headers: { Authorization: `Bearer ${TOK}` } }).catch(() => null);
  if (r2) {
    const u = await r2.json().catch(() => ({}));
    console.log(`payer transtest3 (2094743021490827193): nickname=${u.nickname} email=${u.email} site=${u.site_id} ${JSON.stringify(u).slice(0,150)}`);
  }

  // 3) ¿Quién es test_user_5921243736691050007 (el que creé ayer para las pruebas)?
  const r3 = await fetch("https://api.mercadopago.com/users/5921243736691050007", { headers: { Authorization: `Bearer ${TOK}` } }).catch(() => null);
  if (r3) {
    const u = await r3.json().catch(() => ({}));
    console.log(`test user 5921243736691050007: nickname=${u.nickname} email=${u.email} site=${u.site_id} ${JSON.stringify(u).slice(0,150)}`);
  }

  // 4) Listar TODOS los usuarios de prueba del collector (los creados por ESTA cuenta)
  const r4 = await fetch("https://api.mercadopago.com/users/test_user_search?page=0&per_page=50", { headers: { Authorization: `Bearer ${TOK}` } }).catch(() => null);
  if (r4) {
    const d = await r4.json().catch(() => ({}));
    console.log(`\n=== test users del collector (API test_user_search) HTTP ${r4.status} ===`);
    const list = d.results || d.users || (Array.isArray(d) ? d : []);
    if (list.length) {
      for (const u of list) console.log(`  id=${u.id} email=${u.email}`);
    } else {
      console.log(JSON.stringify(d).slice(0, 400));
    }
  }
})().catch(e => console.error("ERROR:", e.message));
