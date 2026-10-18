// Corre 10 preapprovals REALES en MP sandbox para transtest2 (el access token es de transtest1, entonces transtest1
// no puede ser payer porque sería mismo usuario que collector).
//
// Uso: node scripts/run-real-mp-subs.cjs

const BASE = process.env.AKUO_BASE || "https://akuosplash.cl";
const TRANSTEST2_MP_EMAIL = "test_user_5223087933429886697@testuser.com"; // patrón basado en nickname TESTUSER5223087933429886697

async function login(email, password) {
  const res = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/akuosplash_session=([^;]+)/);
  return match ? match[1] : null;
}

async function setMpTestUserEmail(session, email) {
  const res = await fetch(`${BASE}/api/akuosplash/cliente/perfil`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ mpTestUserEmail: email }),
  });
  return res.ok;
}

async function crearSubscripcionReal(session, plan, ciclo = "mensual") {
  const res = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ plan, ciclo }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || `HTTP ${res.status}` };
  return data;
}

async function main() {
  console.log("\n=== 10 preapprovals REALES para transtest2 ===\n");

  const t = { email: "transtest2@akuosplash.test", password: "TestPass2026!", plan: "pro" };

  // Loguear
  const session = await login(t.email, t.password);
  if (!session) {
    console.log("✗ No se pudo loguear transtest2");
    return;
  }
  console.log(`✓ Logueado ${t.email}`);

  // Setear mpTestUserEmail con patrón
  const ok = await setMpTestUserEmail(session, TRANSTEST2_MP_EMAIL);
  console.log(`${ok ? "✓" : "✗"} mpTestUserEmail seteado: ${TRANSTEST2_MP_EMAIL}\n`);

  // Crear 10 preapprovals REALES
  let okCount = 0, failCount = 0;
  for (let i = 0; i < 10; i++) {
    const result = await crearSubscripcionReal(session, t.plan, "mensual");
    if (result.error) {
      failCount++;
      if (failCount <= 3) console.log(`  [${i+1}/10] ✗ ${result.error}`);
    } else {
      okCount++;
      console.log(`  [${i+1}/10] ✓ preapproval creada (id: ${result.preapprovalId?.substring(0, 16)}...)`);
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Preapprovals REALES creados: ${okCount}/10`);
  console.log(`Fallidos: ${failCount}/10`);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
