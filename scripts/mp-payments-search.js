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

  // 1) Buscar pagos recientes (cobro validación $950 o $8000) con el token DB
  for (const [name, tok] of [["DB", DB_TOKEN], ["ENV", ENV_TOKEN]]) {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/search?limit=20&sort=date_created&criteria=desc`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const d = await r.json();
    const arr = d.results || d.elements || [];
    console.log(`=== PAGOS (${name} token) HTTP ${r.status}: ${arr.length} ===`);
    for (const p of arr.slice(0, 10)) {
      console.log(`  id=${p.id} ${p.date_created} status=${p.status} status_detail=${p.status_detail} amount=$${p.transaction_amount} (${p.payment_method_id||"-"}) desc="${(p.description||"").slice(0,40)}"`);
    }
  }

  // 2) Backup del 9/11: ¿qué token había en la config?
  try {
    const bk = JSON.parse(fs.readFileSync("/home/z/my-project/scripts/backup-planconfigs-1792895942993.json", "utf8"));
    const s = JSON.stringify(bk);
    const m = s.match(/(APP_USR-\d+-\d+-[a-z0-9]+-\d+)/i);
    console.log(`\nbackup 9/11: token embebido: ${m ? m[1].slice(0, 28) + "..." : "(ninguno)"}`);
    const mDb = s.match(/mpSubAccessToken[^,}]*/);
    console.log(`backup 9/11 mpSubAccessToken campo: ${mDb ? mDb[0].slice(0, 60) : "(no está)"}`);
  } catch (e) { console.log("backup 9/11: no legible —", e.message); }

  // 3) backups SQL de pagos — buscar el token en los .sql
  try {
    const sql = fs.readFileSync("/home/z/my-project/scripts/backup-pago-almacigo-1792889664103.sql", "utf8");
    const m = sql.match(/APP_USR-(\d+)-/);
    console.log(`backup SQL (Nov 8): app del token = ${m ? m[1] : "(ninguno)"}`);
  } catch (e) {}
})().catch(e => console.error("ERROR:", e.message));
