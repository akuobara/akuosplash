// Test directo: llama a la API de MP /preapproval con el access token
// para ver si el token funciona y qué formato de payer acepta.
//
// Uso: node scripts/test-mp-direct.cjs

const ACCESS_TOKEN = "APP_USR-2731961034891399-100523-9a2ea0da114449c3d67fe3255fffdce3-3738974993";
const TRANSTEST2_USER = "TESTUSER5223087933429886697";
// MP test users tienen email en formato test_user_<numeric>@testuser.com
// Basado en transtest1 (TESTUSER8470344657267784965 → test_user_8470344657267784965@testuser.com)
// transtest2 sería: test_user_5223087933429886697@testuser.com
const TRANSTEST2_EMAIL = "test_user_5223087933429886697@testuser.com";

async function main() {
  console.log("\n=== Test directo API MP /preapproval ===\n");
  console.log(`Access Token: ${ACCESS_TOKEN.substring(0, 30)}...`);
  console.log(`Payer (transtest2): ${TRANSTEST2_USER}\n`);

  // 1. Probar identificar al usuario del access token (GET /users/me)
  console.log("1. GET /users/me — verificando el access token...");
  try {
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (r.ok) {
      const d = await r.json();
      console.log(`  ✓ Token válido. User ID: ${d.id}, nickname: ${d.nickname}, email: ${d.email}`);
    } else {
      const txt = await r.text();
      console.log(`  ✗ HTTP ${r.status}: ${txt.substring(0, 200)}`);
    }
  } catch (e) {
    console.log(`  ✗ Exception: ${e.message}`);
  }

  // 2. Crear una preapproval de TEST con transtest2 como payer
  console.log("\n2. POST /preapproval — creando preapproval de test...");
  const body = {
    reason: "AkuoSplash — Test plan Pro",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 50000,
      currency_id: "CLP",
    },
    payer_email: TRANSTEST2_EMAIL,
    back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    status: "pending",
    external_reference: `akuo_sub_test:${TRANSTEST2_USER}:pro:mensual`,
    notification_url: "https://akuosplash.cl/api/akuosplash/subscription/mercadopago/webhook",
  };
  try {
    const r = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    if (r.ok) {
      console.log(`  ✓ Preapproval creada!`);
      console.log(`    id: ${d.id}`);
      console.log(`    init_point: ${d.init_point?.substring(0, 60)}...`);
      console.log(`    sandbox_init_point: ${d.sandbox_init_point?.substring(0, 60)}...`);
      console.log(`    status: ${d.status}`);
    } else {
      console.log(`  ✗ HTTP ${r.status}: ${JSON.stringify(d).substring(0, 400)}`);
    }
  } catch (e) {
    console.log(`  ✗ Exception: ${e.message}`);
  }
}

main();
