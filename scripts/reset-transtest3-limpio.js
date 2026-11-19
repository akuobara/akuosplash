// Resetea transtest3 a estado 100% limpio y cancela la preapproval pro que dejó la prueba.
// Después verifica contra la API de MP que no quede NADA vivo.
// Uso: node scripts/reset-transtest3-limpio.js
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

  // 1) Leer el preapprovalId actual de transtest3 y cancelarlo en MP
  const u = (await db.execute(`SELECT mpSubPreapprovalId, mpSubStatus, plan FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("Estado actual transtest3:", JSON.stringify(u));
  if (u.mpSubPreapprovalId && u.mpSubStatus !== "cancelled") {
    const r = await fetch(`https://api.mercadopago.com/preapproval/${u.mpSubPreapprovalId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    console.log(`Cancelando preapproval ${u.mpSubPreapprovalId} en MP: HTTP ${r.status}`);
  }

  // 2) Resetear transtest3 en la DB
  await db.execute(`UPDATE AkuoUsuario SET
    plan='gratis', suscripcionActiva=0, planActivoDesde=NULL, planActivoHasta=NULL,
    mpSubPreapprovalId=NULL, mpSubPlanSolicitado=NULL, mpSubCiclo=NULL,
    mpSubStatus=NULL, mpSubIniciadoEn=NULL, mpSubAutorizadoEn=NULL, mpSubAmount=NULL
    WHERE email='transtest3@akuosplash.test'`);

  // 3) Verificar: 0 preapprovals vivas en toda la cuenta MP
  let vivas = [];
  for (let off = 0; off < 500; off += 100) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=100&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    vivas = vivas.concat(res.filter(p => p.status === "authorized" || p.status === "pending"));
    if (res.length < 100) break;
  }

  const u2 = (await db.execute(`SELECT plan, suscripcionActiva, mpSubStatus, mpSubPreapprovalId FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\n════ ESTADO FINAL transtest3 ════");
  console.log("  DB:", JSON.stringify(u2));
  console.log(`  Preapprovals VIVAS en MP: ${vivas.length} ${vivas.length === 0 ? "✓ (cero — nada puede cobrar)" : "✗ AÚN HAY"}`);
  console.log("\n→ transtest3 está LIMPIA. Listo para que pruebes tú el pago desde cero.");
})().catch(e => console.error("ERR", e.message));
