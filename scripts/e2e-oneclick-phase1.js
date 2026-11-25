// E2E Oneclick — FASE 1: reset transtest3 + crear inscripción + imprimir URL.
// El usuario abre la URL en su navegador (IP casera pasa WAF), inscribe la tarjeta de prueba,
// y avisa. Luego corro la fase 2 (authorize + refund + verify).
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

(async () => {
  // 1. Reset transtest3 (limpia cualquier inscripción previa)
  await db.execute({
    sql: `UPDATE AkuoUsuario SET plan='gratis', planActivoDesde=NULL, planActivoHasta=NULL, suscripcionActiva=0, suscripcionInicio=NULL, suscripcionFin=NULL, transbankStatus=NULL, transbankAuthorizationCode=NULL, transbankAmount=NULL, transbankPlanSolicitado=NULL, transbankCiclo=NULL, transbankIniciadoEn=NULL, transbankAutorizadoEn=NULL, transbankBuyOrder=NULL, transbankTokenWs=NULL, tbkUsername=NULL, tbkUser=NULL, tbkCardType=NULL, tbkCardLast4=NULL, tbkInscriptionStatus=NULL, tbkInscriptionToken=NULL, tbkInscriptionEmail=NULL, tbkSubscriptionActive=0, tbkLastCobroBuyOrder=NULL, tbkLastCobroEn=NULL, tbkLastCobroAuthCode=NULL WHERE email=?`,
    args: [EMAIL],
  });
  console.log("✓ transtest3 reseteada");

  // 2. Login
  const lr = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const sc = lr.headers.get("set-cookie") || "";
  const m = sc.match(/akuosplash_session=([^;]+)/);
  if (!m) { console.log("✗ login falló:", lr.status); return; }
  const sess = m[1];
  console.log("✓ login OK (transtest3)");

  // 3. Start inscription
  const r = await fetch(`${BASE}/api/akuosplash/subscription/transbank/oneclick/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${sess}` },
    body: JSON.stringify({}),
  });
  const b = await r.json().catch(() => ({}));
  if (r.status !== 200 || !b.url) {
    console.log("✗ /oneclick/start falló:", r.status, JSON.stringify(b));
    return;
  }
  console.log("✓ inscripción creada (token:", (b.token || "").slice(0, 16) + "...)\n");
  console.log("========================================");
  console.log("ABRÍ ESTA URL EN TU NAVEGADOR (IP casera):");
  console.log(b.url);
  console.log("========================================");
  console.log("\nDatos de prueba (tarjeta Oneclick integración):");
  console.log("  Tarjeta:  VISA  4051 8856 0044 6623");
  console.log("  CVV:      123");
  console.log("  Venc:     cualquier fecha futura (ej 12/28)");
  console.log("  RUT:      11.111.111-1");
  console.log("  Clave:    123");
  console.log("\n→ Inscribí la tarjeta y decime 'listo' para correr la fase 2 (authorize + refund).");
})().catch(e => console.error("ERR", e.message));
