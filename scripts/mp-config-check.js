const { createClient } = require("@libsql/client");
const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const url = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const authToken = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url, authToken });

(async () => {
  // 1) AkuoConfig MP settings
  const cfg = await db.execute(
    `SELECT mpSandbox, mpSubAccessToken, mpSubPublicKey, mpAccessToken, mpPublicKey FROM AkuoConfig WHERE activo = 1 LIMIT 1`
  );
  const r = cfg.rows[0] || {};
  console.log("=== AkuoConfig (MP) ===");
  console.log(`  mpSandbox = ${r.mpSandbox}  (null→ default env)`);
  console.log(`  mpSubAccessToken prefix = ${r.mpSubAccessToken ? String(r.mpSubAccessToken).slice(0,12) : "(null)"}  len=${r.mpSubAccessToken ? String(r.mpSubAccessToken).length : 0}`);
  console.log(`  mpSubPublicKey prefix = ${r.mpSubPublicKey ? String(r.mpSubPublicKey).slice(0,12) : "(null)"}`);
  console.log(`  mpAccessToken prefix = ${r.mpAccessToken ? String(r.mpAccessToken).slice(0,12) : "(null)"}`);

  // 2) env AKUO_MP_SANDBOX en create-render-service.py
  const envSandbox = grab(/"key":\s*"AKUO_MP_SANDBOX"[^}]*?"value":\s*"([^"]+)"/);
  console.log(`  env AKUO_MP_SANDBOX = ${envSandbox ?? "(no seteado)"}`);
})().catch(e => console.error("ERROR:", e.message));
