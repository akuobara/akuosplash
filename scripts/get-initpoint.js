// Crea un preapproval_plan con el token APP_USR- y devuelve el init_point para probar
// el checkout real con tarjeta de test. Guarda el plan_id en transtest3 para que /sync lo encuentre.
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
  const api = "https://api.mercadopago.com";
  const u = (await db.execute(`SELECT id FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  const userId = u.id;
  const extRef = `akuo_sub:${userId}:premium:mensual`;

  // Crear preapproval_plan (camino producción — devuelve init_point)
  const pl = await (await fetch(`${api}/preapproval_plan`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "AkuoSplash — Plan Premium (mensual)",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 7990, currency_id: "CLP" },
      external_reference: extRef,
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion&mp=ok",
    }),
  })).json();
  if (!pl.id) { console.log("✗ plan falló:", JSON.stringify(pl)); return; }
  console.log("plan_id:", pl.id);
  console.log("init_point:", pl.init_point || "(ninguno)");
  console.log("sandbox_init_point:", pl.sandbox_init_point || "(ninguno — token APP_USR- no devuelve sandbox)");

  // Guardar plan_id en transtest3 (como haría /create producción)
  await db.execute({
    sql: `UPDATE AkuoUsuario SET mpSubPreapprovalId=?, mpSubPlanSolicitado='premium', mpSubCiclo='mensual', mpSubStatus='pending', mpSubAmount=7990, plan='gratis', suscripcionActiva=0 WHERE id=?`,
    args: [pl.id, userId],
  });
  console.log("\nplan_id guardado en transtest3. Listo para abrir el init_point en el navegador.");
  console.log("URL para abrir:", pl.init_point);
})().catch(e => console.error("ERR", e.message));
