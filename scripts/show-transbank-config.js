const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  // AkuoConfig en el DB compartido (no pedimos apiKey)
  const r = await db.execute(
    "SELECT transbankCommerceCode, transbankEnvironment, transbankOneclickMallCode, transbankOneclickChildCode, (CASE WHEN transbankApiKey IS NULL OR transbankApiKey='' THEN 'no' ELSE 'si' END) as apiKeySet FROM AkuoConfig LIMIT 5"
  );
  if (!r.rows.length) { console.log("AkuoConfig: tabla no existe o vacía en este DB"); return; }
  for (const x of r.rows) console.log("AkuoConfig:", JSON.stringify(x));
})().catch(e => console.error("ERR", e.message));
