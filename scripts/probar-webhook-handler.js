// Verifica que el HANDLER del webhook funciona, mandándole yo la notificación
// con una preapproval REAL que MP ya autorizó. Así aislamos handler (código) de delivery (MP).
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const WEBHOOK = "https://akuosplash.cl/api/akuosplash/subscription/mercadopago/webhook";
// preapproval real autorizada por MP en el test anterior (notification_url)
const PREAPPROVAL_ID = "d72bc20c4f6a4f51926f8d9da6d90bb7";

(async () => {
  const antes = (await db.execute(`SELECT plan, mpSubStatus, suscripcionActiva FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("ANTES:", JSON.stringify(antes));
  console.log(`\nPOST ${WEBHOOK}`);
  console.log(`  body: { type: "subscription_preapproval", data: { id: "${PREAPPROVAL_ID}" } }`);

  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "subscription_preapproval", data: { id: PREAPPROVAL_ID } }),
  });
  const body = await res.text();
  console.log("HTTP:", res.status);
  console.log("Respuesta:", body.slice(0, 300));

  const despues = (await db.execute(`SELECT plan, mpSubStatus, suscripcionActiva, mpSubAmount, planActivoHasta FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\nDESPUÉS:", JSON.stringify(despues));
  console.log("\n════ VEREDICTO ════");
  if (despues.plan === "premium" && despues.suscripcionActiva == 1) {
    console.log("✓ HANDLER FUNCIONA: al recibir la notificación, activó el plan correctamente.");
    console.log("✓ El código de producción está bien. Lo único que falta: que MP DISPARE el webhook.");
    console.log("→ FIX: registrar la URL en el panel de MP (evento subscription_preapproval + payment).");
  } else {
    console.log("✗ Handler no activó el plan — bug en el código del webhook también.");
  }
})().catch(e => console.error("ERR", e.message));
