// Intenta listar/registrar el webhook de MP por API con el token test.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const WEBHOOK_URL = "https://akuosplash.cl/api/akuosplash/subscription/mercadopago/webhook";

(async () => {
  const r = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const T = String(r.rows[0].mpSubAccessToken || "");

  for (const path of ["/webhooks", "/v1/webhooks"]) {
    console.log(`=== GET ${path} ===`);
    const g = await fetch("https://api.mercadopago.com" + path, { headers: { Authorization: `Bearer ${T}` } });
    const txt = await g.text();
    console.log("HTTP", g.status, txt.slice(0, 200));
  }

  console.log(`\n=== POST /webhooks (registrar ${WEBHOOK_URL}) ===`);
  const p = await fetch("https://api.mercadopago.com/webhooks", {
    method: "POST",
    headers: { Authorization: `Bearer ${T}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: WEBHOOK_URL, events: ["subscription_preapproval", "payment"] }),
  });
  const ptxt = await p.text();
  console.log("HTTP", p.status, ptxt.slice(0, 300));
})().catch(e => console.error("ERR", e.message));
