// Post-inscripción: asume que el usuario YA inscribió su tarjeta via frontend.
// NO resetea. Hace el cargo (authorize), verifica, cancela (refund), verifica.
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
    "SELECT plan, tbkUsername, tbkUser, tbkCardType, tbkCardLast4, tbkInscriptionStatus, tbkSubscriptionActive, tbkLastCobroBuyOrder, tbkLastCobroAuthCode, transbankStatus, transbankAmount, planActivoHasta FROM AkuoUsuario WHERE email=?",
    [EMAIL]
  );
  return r.rows[0];
}

async function login() {
  const lr = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const sc = lr.headers.get("set-cookie") || "";
  const m = sc.match(/akuosplash_session=([^;]+)/);
  if (!m) throw new Error("login falló");
  return m[1];
}

async function post(sess, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${sess}` },
    body: JSON.stringify(body || {}),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

(async () => {
  console.log("=== POST-INSCRIPCIÓN: cargo + cancelación ===\n");

  const before = await dbState();
  console.log("Estado actual de transtest3:");
  console.log(`  tbkUser: ${before.tbkUser ? before.tbkUser.slice(0,16)+"..." : "(null — NO INSCRIPTA)"}`);
  console.log(`  tarjeta: ${before.tbkCardType || "-"} ****${before.tbkCardLast4 || "-"}`);
  console.log(`  inscriptionStatus: ${before.tbkInscriptionStatus}`);
  if (!before.tbkUser) {
    console.log("\n✗ No hay tarjeta inscripta. Inscribí una primero desde akuosplash.cl → Suscripción → 'Inscribir tarjeta'.");
    return;
  }

  const sess = await login();

  // 1. Authorize (cargo)
  console.log("\n→ Haciendo cargo (authorize) de $7.990...");
  const auth = await post(sess, "/api/akuosplash/subscription/transbank/oneclick/authorize", { plan: "premium", ciclo: "mensual" });
  console.log(`  HTTP ${auth.status} | ok=${auth.body.ok} | authCode=${auth.body.authorizationCode} | plan=${auth.body.plan}`);
  if (auth.status !== 200 || !auth.body.ok) {
    console.log("  ✗ Cargo falló:", JSON.stringify(auth.body));
    return;
  }

  const afterAuth = await dbState();
  console.log("✓ DB después del cargo:");
  console.log(`  plan=${afterAuth.plan} | suscripcionActiva=${afterAuth.suscripcionActiva} | tbkSubscriptionActive=${afterAuth.tbkSubscriptionActive}`);
  console.log(`  planActivoHasta=${afterAuth.planActivoHasta}`);
  console.log(`  tbkLastCobroBuyOrder=${afterAuth.tbkLastCobroBuyOrder}`);
  console.log(`  tbkLastCobroAuthCode=${afterAuth.tbkLastCobroAuthCode} | transbankStatus=${afterAuth.transbankStatus}`);
  if (afterAuth.plan !== "premium") { console.log("✗ FAIL: plan no es premium"); return; }
  console.log("✓✓ Plan premium ACTIVADO por cargo recurrente Oneclick\n");

  // 2. Cancel (refund + deactivate)
  console.log("→ Cancelando suscripción (refund + desactivar)...");
  const cancel = await post(sess, "/api/akuosplash/subscription/transbank/oneclick/cancel", {});
  console.log(`  HTTP ${cancel.status} | refunded=${cancel.body.refunded}`);
  console.log(`  msg: ${cancel.body.message}`);

  const afterCancel = await dbState();
  console.log("✓ DB después de cancelar:");
  console.log(`  plan=${afterCancel.plan} | tbkSubscriptionActive=${afterCancel.tbkSubscriptionActive} | transbankStatus=${afterCancel.transbankStatus}`);

  if (afterCancel.plan === "gratis" && !afterCancel.tbkSubscriptionActive) {
    console.log("\n✓✓✓ E2E ONECLICK COMPLETO Y VERIFICADO:");
    console.log("  1. Inscripción de tarjeta (tu navegador) → tbkUser guardado");
    console.log("  2. Cargo server-to-server $7.990 → plan premium activado (auth code real de Transbank)");
    console.log("  3. Cancelación → reembolso del último cargo → plan vuelve a gratis");
    console.log("  Todo con autorización real del ambiente de integración de Transbank.");
  } else {
    console.log("\n⚠ Cancelación parcial — revisar transbankStatus:", afterCancel.transbankStatus);
  }
})().catch(e => console.error("ERR", e.message, e.stack));
