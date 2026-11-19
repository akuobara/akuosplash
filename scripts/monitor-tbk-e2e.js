// Monitorea transtest3 en la DB — cuando el usuario pague en el checkout de Webpay,
// el /return hace commit y activa el plan. Este script polla hasta ver el resultado.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  const start = Date.now();
  let lastStatus = null;
  console.log("Monitoreando transtest3 (Ctrl+C para parar)...");
  while (Date.now() - start < 8 * 60 * 1000) {
    const u = (await db.execute(
      "SELECT plan, transbankStatus, transbankBuyOrder, transbankAmount, transbankAuthorizationCode, transbankAutorizadoEn, planActivoHasta FROM AkuoUsuario WHERE email=?",
      ["transtest3@akuosplash.test"]
    )).rows[0];
    if (u.transbankStatus !== lastStatus) {
      console.log(`[${Math.round((Date.now() - start) / 1000)}s]`, JSON.stringify(u));
      lastStatus = u.transbankStatus;
    }
    if (u.plan === "premium" && u.transbankStatus === "AUTHORIZED") {
      console.log("\n✓✓✓ E2E COMPLETO: pago Webpay → commit → plan premium ACTIVADO");
      console.log("  AuthorizationCode:", u.transbankAuthorizationCode);
      console.log("  Activo hasta:", u.planActivoHasta);
      return;
    }
    if (["FAILED", "REJECTED", "ERROR", "USER_CANCELED"].includes(u.transbankStatus || "")) {
      console.log("\n✗ El pago falló o fue cancelado. Estado:", u.transbankStatus);
      return;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  console.log("\n⏳ 8 min sin cambio. El usuario no completó el pago aún.");
})().catch(e => console.error("ERR", e.message));
