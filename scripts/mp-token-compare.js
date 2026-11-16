const { createClient } = require("@libsql/client");
const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const url = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const authToken = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url, authToken });

(async () => {
  // leer token de la DB
  const cfg = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const DB_TOKEN = cfg.rows[0]?.mpSubAccessToken;
  console.log(`ENV_TOKEN prefix=${ENV_TOKEN.slice(0,16)}  len=${ENV_TOKEN.length}`);
  console.log(`DB_TOKEN  prefix=${DB_TOKEN ? String(DB_TOKEN).slice(0,16) : "(null)"}  len=${DB_TOKEN ? String(DB_TOKEN).length : 0}`);
  console.log(`¿Iguales? ${DB_TOKEN === ENV_TOKEN ? "SÍ (mismo token)" : "NO (DISTINTOS — cuentas/credenciales diferentes)"}`);

  // probar cada token contra MP /preapproval/search
  for (const [label, tok] of [["ENV_TOKEN", ENV_TOKEN], ["DB_TOKEN", DB_TOKEN]]) {
    if (!tok) { console.log(`\n${label}: sin token`); continue; }
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=5`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const d = await r.json().catch(() => ({}));
    const results = d.results || d.elements || [];
    const n = results.length;
    const ids = results.map(p => p.id).join(",");
    const collectors = [...new Set(results.map(p => p.collector_id))].join(",");
    console.log(`\n${label}: HTTP ${r.status}  count=${n}  collector_id=[${collectors}]`);
    console.log(`  ids: ${ids}`);
    if (r.status !== 200 || d.error) console.log(`  err: ${JSON.stringify(d).slice(0,200)}`);
  }
})().catch(e => console.error("ERROR:", e.message));
