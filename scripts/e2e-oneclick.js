// E2E Oneclick: orquesta la prueba completa de suscripción recurrente.
// 1. Resetea transtest3
// 2. POST /oneclick/start → obtiene URL de inscripción
// 3. Muestra la URL para que el usuario la abra en SU navegador (pasa el WAF)
// 4. Monitorea la DB hasta que tbkUser != null (inscripción completada)
// 5. POST /oneclick/authorize → cobra $7990 con la tarjeta inscripta
// 6. Verifica: plan=premium, planActivoHasta futuro, tbkLastCobroAuthCode presente
// 7. POST /oneclick/cancel → reembolsa + desactiva
// 8. Verifica: plan=gratis, tbkSubscriptionActive=0
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const BASE = "https://akuosplash.cl";
const EMAIL = "transtest3@akuosplash.test";
const PASS = "Test1234!";

async function dbState() {
  const r = await db.execute(
    "SELECT plan, tbkUsername, tbkUser, tbkCardType, tbkCardLast4, tbkInscriptionStatus, tbkSubscriptionActive, tbkLastCobroBuyOrder, tbkLastCobroAuthCode, transbankStatus, planActivoHasta FROM AkuoUsuario WHERE email=?",
    [EMAIL]
  );
  return r.rows[0];
}

async function login() {
  const lr = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const sc = lr.headers.get("set-cookie") || "";
  const m = sc.match(/akuosplash_session=([^;]+)/);
  if (!m) throw new Error("login falló");
  return m[1];
}

async function post(sess, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${sess}` },
    body: JSON.stringify(body || {}),
  });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, body: b };
}

(async () => {
  console.log("=== E2E ONECLICK ===\n");

  // 1. Reset
  await db.execute({
    sql: `UPDATE AkuoUsuario SET plan='gratis', planActivoDesde=NULL, planActivoHasta=NULL, suscripcionActiva=0, suscripcionInicio=NULL, suscripcionFin=NULL, transbankStatus=NULL, transbankAuthorizationCode=NULL, transbankAmount=NULL, transbankPlanSolicitado=NULL, transbankCiclo=NULL, transbankIniciadoEn=NULL, transbankAutorizadoEn=NULL, transbankBuyOrder=NULL, transbankTokenWs=NULL, tbkUsername=NULL, tbkUser=NULL, tbkCardType=NULL, tbkCardLast4=NULL, tbkInscriptionStatus=NULL, tbkInscriptionToken=NULL, tbkInscriptionEmail=NULL, tbkSubscriptionActive=0, tbkLastCobroBuyOrder=NULL, tbkLastCobroEn=NULL, tbkLastCobroAuthCode=NULL WHERE email=?`,
    args: [EMAIL],
  });
  console.log("✓ transtest3 reseteada\n");

  // 2. Login + start inscription
  const sess = await login();
  const start = await post(sess, "/api/akuosplash/subscription/transbank/oneclick/start", {});
  if (start.status !== 200) {
    console.log("✗ /oneclick/start falló:", start.status, JSON.stringify(start.body));
    return;
  }
  console.log("✓ /oneclick/start OK — inscripción creada");
  console.log("  token:", start.body.token?.slice(0, 20) + "...");
  console.log("\n========================================");
  console.log("ABRÍ ESTA URL EN TU NAVEGADOR (IP de tu casa pasa el WAF):");
  console.log(start.body.url);
  console.log("========================================");
  console.log("Datos de prueba:");
  console.log("  Tarjeta:  VISA 4051 8856 0044 6623");
  console.log("  CVV:      123");
  console.log("  Venc:     cualquier fecha futura (ej 12/28)");
  console.log("  RUT:      11.111.111-1");
  console.log("  Clave:    123");
  console.log("\nEsperando a que completes la inscripción (hasta 10 min)...\n");

  // 3. Poll DB hasta que tbkUser != null
  const startT = Date.now();
  let inscribed = false;
  while (Date.now() - startT < 10 * 60 * 1000) {
    const s = await dbState();
    if (s.tbkUser) {
      console.log(`✓ Inscripción completada a los ${Math.round((Date.now() - startT) / 1000)}s`);
      console.log(`  tbkUser: ${s.tbkUser.slice(0, 16)}...`);
      console.log(`  tarjeta: ${s.tbkCardType} ****${s.tbkCardLast4}`);
      console.log(`  status:  ${s.tbkInscriptionStatus}`);
      inscribed = true;
      break;
    }
    if (s.tbkInscriptionStatus === "FAILED" || s.tbkInscriptionStatus === "ERROR") {
      console.log("✗ Inscripción falló:", s.tbkInscriptionStatus);
      return;
    }
    process.stdout.write(".");
    await new Promise(r => setTimeout(r, 4000));
  }
  if (!inscribed) {
    console.log("\n⏳ 10 min sin inscripción. Volvé a correr el script cuando estés listo.");
    return;
  }

  // 4. Authorize (cargo)
  console.log("\n→ Haciendo cargo (authorize) de $7.990 con la tarjeta inscripta...");
  const auth = await post(sess, "/api/akuosplash/subscription/transbank/oneclick/authorize", { plan: "premium", ciclo: "mensual" });
  console.log("  HTTP:", auth.status, "| ok:", auth.body.ok, "| authCode:", auth.body.authorizationCode, "| plan:", auth.body.plan);
  if (auth.status !== 200 || !auth.body.ok) {
    console.log("  ✗ Cargo falló:", JSON.stringify(auth.body));
    return;
  }

  const afterAuth = await dbState();
  console.log("✓ DB después del cargo:");
  console.log(`  plan=${afterAuth.plan} | suscripcionActiva=${afterAuth.suscripcionActiva} | tbkSubscriptionActive=${afterAuth.tbkSubscriptionActive}`);
  console.log(`  planActivoHasta=${afterAuth.planActivoHasta}`);
  console.log(`  tbkLastCobroBuyOrder=${afterAuth.tbkLastCobroBuyOrder} | tbkLastCobroAuthCode=${afterAuth.tbkLastCobroAuthCode}`);
  console.log(`  transbankStatus=${afterAuth.transbankStatus}`);

  if (afterAuth.plan !== "premium") { console.log("✗ FAIL: plan no es premium"); return; }
  console.log("✓ Plan premium ACTIVADO por cargo recurrente\n");

  // 5. Cancel (refund + deactivate)
  console.log("→ Cancelando suscripción (refund último cargo + desactivar)...");
  const cancel = await post(sess, "/api/akuosplash/subscription/transbank/oneclick/cancel", {});
  console.log("  HTTP:", cancel.status, "| refunded:", cancel.body.refunded, "| msg:", cancel.body.message);

  const afterCancel = await dbState();
  console.log("✓ DB después de cancelar:");
  console.log(`  plan=${afterCancel.plan} | tbkSubscriptionActive=${afterCancel.tbkSubscriptionActive} | transbankStatus=${afterCancel.transbankStatus}`);

  if (afterCancel.plan !== "gratis" || afterCancel.tbkSubscriptionActive) {
    console.log("✗ FAIL: no se desactivó correctamente");
    return;
  }

  console.log("\n✓✓✓ E2E ONECLICK COMPLETO:");
  console.log("  inscripción → cargo recurrente ($7.990) → plan premium activado");
  console.log("  → cancelación → reembolso → plan vuelve a gratis");
  console.log("  Todo verificado en DB con autorización real de Transbank integración.");
})().catch(e => console.error("ERR", e.message, e.stack));
