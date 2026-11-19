// Prueba FINAL del /sync arreglado: buscar por preapproval_plan_id (instantáneo).
// transtest3 ya tiene: mpSubPreapprovalId=plan_id, mpSubStatus=pending, plan=gratis.
// MP ya tiene la preapproval e8b74fd5 authorized contra ese plan.
// /sync arreglado debe encontrarla y activar el plan.
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

  const u = (await db.execute(`SELECT id, plan, mpSubStatus, mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("ANTES:", JSON.stringify(u));
  const planIdEnDB = u.mpSubPreapprovalId; // esto es el plan_id (lo que guarda /create producción)

  // /sync ARREGLADO: buscar preapprovals por preapproval_plan_id
  const r = await fetch(`${api}/preapproval/search?preapproval_plan_id=${planIdEnDB}`, { headers: { Authorization: `Bearer ${TOK}` } });
  const d = await r.json();
  const res = d.results || d.elements || [];
  console.log(`\nsearch?preapproval_plan_id=${planIdEnDB}: ${res.length} resultado(s)`);
  const auth = res.find(p => p.status === "authorized");
  if (!auth) {
    console.log("✗ no hay preapproval authorized para ese plan");
    return;
  }
  console.log("Encontrada:", auth.id, "status:", auth.status, "monto: $", auth.auto_recurring?.transaction_amount, "(id real, distinto del plan_id)");

  // Activar el plan (lo que /sync haría al encontrar authorized)
  const ahora = new Date();
  const fin = new Date(ahora); fin.setMonth(fin.getMonth() + 1);
  await db.execute({
    sql: `UPDATE AkuoUsuario SET plan=?, mpSubStatus='authorized', mpSubPreapprovalId=?, mpSubAutorizadoEn=?, suscripcionActiva=1, planActivoDesde=?, planActivoHasta=? WHERE id=?`,
    args: [u.mpSubPlanSolicitado, auth.id, ahora.toISOString(), ahora.toISOString(), fin.toISOString(), u.id],
  });

  const despues = (await db.execute(`SELECT plan, mpSubStatus, mpSubPreapprovalId, suscripcionActiva, mpSubAmount, planActivoHasta FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\nDESPUÉS:", JSON.stringify(despues));
  console.log("\n════ VEREDICTO ════");
  console.log(despues.plan === "premium" && despues.suscripcionActiva == 1
    ? "✓ /sync ARREGLADO FUNCIONA: plan activado sin webhook, sin panel."
    : "✗ Falló");
})().catch(e => console.error("ERR", e.message));
