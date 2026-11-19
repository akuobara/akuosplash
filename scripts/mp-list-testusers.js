// Crea un usuario de test COMPRADOR nuevo vía la API de MP (cuenta limpia, sin historial).
// Para verificar el flujo real sin tocar transtest3.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");
  // Listar test users existentes primero (para no crear de más)
  const lr = await fetch(`https://api.mercadopago.com/users/test_user?site_id=MLC`, {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const lb = await lr.json();
  console.log("Test users existentes:", lr.status, Array.isArray(lb) ? lb.length : "(none)", lb);
})().catch(e => console.error("ERR", e.message));
