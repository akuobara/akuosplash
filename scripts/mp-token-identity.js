const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken, mpSubPublicKey, mpInstantAccessToken, mpInstantPublicKey FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const DB_TOKEN = String(rc.rows[0].mpSubAccessToken);
  console.log(`DB mpSubPublicKey: ${String(rc.rows[0].mpSubPublicKey).slice(0, 30)}...`);
  console.log(`DB mpInstantPublicKey: ${String(rc.rows[0].mpInstantPublicKey).slice(0, 30)}...`);

  // /users/me con cada token: ¿de quién es cada app?
  for (const [name, tok] of [["DB (mpSubAccessToken)", DB_TOKEN], ["ENV (AKUO_MP_ACCESS_TOKEN)", ENV_TOKEN]]) {
    const r = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${tok}` } });
    const u = await r.json();
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify({ id: u.id, nickname: u.nickname, email: u.email, site_id: u.site_id, account_type: u.account_type ?? null, is_test: u.is_test ?? null }, null, 1));
    // detalle de la app
    if (u.id) {
      try {
        const ar = await fetch(`https://api.mercadopago.com/applications?owner_id=${u.id}`, { headers: { Authorization: `Bearer ${tok}` } });
        const apps = await ar.json();
        const list = Array.isArray(apps) ? apps : (apps.applications || []);
        for (const a of list) {
          console.log(`  app: id=${a.id} name="${a.name}" status=${a.status} homescreen=${a.home_url || "-"}`);
        }
      } catch (e) { console.log("  (apps lookup falló)", e.message); }
    }
  }

  // ¿El plan actual fue creado con credenciales de PRUEBA? Intentar con header de test
  // MP Chile: las credenciales de prueba también son APP_USR. Buscar si el checkout del plan
  // corre en modo test — el init_point no cambia, pero verificemos si MP expone algo en el plan.
  const pr = await fetch("https://api.mercadopago.com/preapproval_plan/0e6bfcec44fc48aa81c1e33e099d87fa", {
    headers: { Authorization: `Bearer ${DB_TOKEN}` },
  });
  const plan = await pr.json();
  console.log(`\nplan app=${plan.application_id} collector=${plan.collector_id}`);
})().catch(e => console.error("ERROR:", e.message));
