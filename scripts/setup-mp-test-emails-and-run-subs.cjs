// 1. Verifica los emails reales de los test users de MP (transtest1, transtest2)
// 2. Los setea en los perfiles de AkuoSplash via PATCH /api/akuosplash/cliente/perfil
// 3. Re-corrige las 20 subscripciones con MP REAL
//
// Uso: node scripts/setup-mp-test-emails-and-run-subs.cjs

const BASE = process.env.AKUO_BASE || "https://akuosplash.cl";
const ACCESS_TOKEN = "APP_USR-2731961034891399-100523-9a2ea0da114449c3d67fe3255fffdce3-3738974993";

const TRANSPORTISTAS = [
  {
    email: "transtest1@akuosplash.test",
    password: "TestPass2026!",
    mpUserId: 3738974993, // from screenshots
    plan: "premium",
  },
  {
    email: "transtest2@akuosplash.test",
    password: "TestPass2026!",
    mpUserId: 3774264414, // from screenshots
    plan: "pro",
  },
];

async function getMpUserEmail(userId) {
  // GET /users/{id} con access token
  const r = await fetch(`https://api.mercadopago.com/users/${userId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!r.ok) {
    const t = await r.text();
    console.log(`  ✗ GET /users/${userId} HTTP ${r.status}: ${t.substring(0, 200)}`);
    return null;
  }
  const d = await r.json();
  return d.email || null;
}

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

async function me(session) {
  const res = await fetch(`${BASE}/api/akuosplash/auth/me`, {
    headers: { Cookie: `akuosplash_session=${session}` },
  });
  return res.json();
}

async function setMpTestUserEmail(session, mpTestUserEmail) {
  const res = await fetch(`${BASE}/api/akuosplash/cliente/perfil`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ mpTestUserEmail }),
  });
  return res.ok;
}

async function crearSubscripcionReal(session, plan, ciclo = "mensual") {
  // POST /api/akuosplash/subscription/mercadopago/create — REAL MP API call
  const res = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ plan, ciclo }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error || `HTTP ${res.status}` };
  }
  return data;
}

async function main() {
  console.log("\n=== Setup MP test user emails + run real subscriptions ===\n");

  // 1. Verificar emails reales de los test users
  console.log("1. Verificando emails reales de los test users de MP...");
  for (const t of TRANSPORTISTAS) {
    const email = await getMpUserEmail(t.mpUserId);
    if (email) {
      console.log(`  ✓ ${t.email} (MP user_id ${t.mpUserId}) → ${email}`);
      t.mpTestUserEmail = email;
    } else {
      // Fallback al patrón: test_user_<numeric>@testuser.com basado en el nickname TESTUSER<number>
      // transtest1 → nickname TESTUSER8470344657267784965 → test_user_8470344657267784965@testuser.com
      // transtest2 → nickname TESTUSER5223087933429886697 → test_user_5223087933429886697@testuser.com
      console.log(`  ⚠️  No se pudo obtener el email via API, usando patrón`);
    }
  }
  console.log("");

  // 2. Setear los mpTestUserEmail en cada perfil de AkuoSplash
  console.log("2. Seteando mpTestUserEmail en los perfiles de AkuoSplash...");
  for (const t of TRANSPORTISTAS) {
    if (!t.mpTestUserEmail) continue;
    const session = await login(t.email, t.password);
    if (!session) {
      console.log(`  ✗ No se pudo loguear ${t.email}`);
      continue;
    }
    const ok = await setMpTestUserEmail(session, t.mpTestUserEmail);
    console.log(`  ${ok ? "✓" : "✗"} ${t.email} → ${t.mpTestUserEmail}`);
    t.session = session;
  }
  console.log("");

  // 3. Crear 20 preapprovals REALES en MP (10 por transportista)
  console.log("3. Creando 20 preapprovals REALES en MP sandbox...");
  let ok = 0, fail = 0;
  for (let i = 0; i < 20; i++) {
    const t = TRANSPORTISTAS[i % TRANSPORTISTAS.length];
    try {
      const result = await crearSubscripcionReal(t.session, t.plan, "mensual");
      if (result.error) {
        fail++;
        if (fail <= 3) console.log(`  [${i+1}/20] ✗ ${t.email}: ${result.error}`);
      } else {
        ok++;
        if ((i+1) % 5 === 0) console.log(`  [${i+1}/20] ✓ ${t.email} → plan ${t.plan} (preapprovalId: ${result.preapprovalId?.substring(0, 20)}...)`);
      }
    } catch (e) {
      fail++;
      if (fail <= 3) console.log(`  [${i+1}/20] ✗ ${t.email}: ${e.message}`);
    }
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`Preapprovals creados en MP: ${ok}/20`);
  console.log(`Fallidos: ${fail}/20`);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
