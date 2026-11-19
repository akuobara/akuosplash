// Setea credenciales Transbank INTEGRACION en la DB y prueba createTransaction directo.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  // 1) Guardar credenciales de integración (públicas, doc oficial Transbank)
  await db.execute({
    sql: `UPDATE AkuoConfig SET transbankCommerceCode=?, transbankApiKey=?, transbankEnvironment='INTEGRACION' WHERE activo=1`,
    args: ["597055555532", "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C"],
  });
  console.log("✓ Credenciales Transbank integración guardadas en AkuoConfig");

  // 2) Probar createTransaction directo contra webpay3gint
  const r = await fetch("https://webpay3gint.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions", {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": "597055555532",
      "Tbk-Api-Key-Secret": "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      buy_order: "AKSTEST" + Date.now().toString(36).toUpperCase().slice(-6),
      session_id: "test-session-1",
      amount: 7990,
      return_url: "https://akuosplash.cl/api/akuosplash/subscription/transbank/return",
    }),
  });
  const data = await r.json().catch(() => ({}));
  console.log(`createTransaction: HTTP ${r.status}`);
  console.log("Respuesta:", JSON.stringify(data));
  if (r.status === 200 && data.token && data.url) {
    console.log("\n✓ TRANSBANK INTEGRACIÓN RESPONDE. URL de pago:");
    console.log(data.url + "?token_ws=" + data.token);
  }
})().catch(e => console.error("ERR", e.message));
