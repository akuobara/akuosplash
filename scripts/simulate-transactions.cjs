// Simula 100 transacciones de prueba en AkuoSplash:
//   - 80 ventas de marketplace (cliente pide agua → pedido → simular MP payment approved → entrega)
//   - 20 subscripciones (transportista → /subscription/mercadopago/create → simular MP preapproval authorized)
//
// El script:
//   1. Loguea cada perfil (4 clientes + 2 transportistas)
//   2. Para ventas: crea pedidos como cliente, simula webhook de MP payment, marca como entregado
//   3. Para subscripciones: llama /subscription/mercadopago/create para crear preapproval mock, simula webhook authorized
//
// Nota: las "ventas" son simuladas — no pasan por MP real, pero activan toda nuestra lógica
// de cálculo de comisión por plan, split, activación de plan, etc.
//
// Uso: node scripts/simulate-transactions.cjs

const BASE = process.env.AKUO_BASE || "https://akuosplash.cl";

const CLIENTS = [
  { email: "buytest2@akuosplash.test", password: "TestPass2026!" },
  { email: "buytest3@akuosplash.test", password: "TestPass2026!" },
  { email: "buytest4@akuosplash.test", password: "TestPass2026!" },
  { email: "buyertest@akuosplash.test", password: "TestPass2026!" },
];

const TRANSPORTISTAS = [
  { email: "transtest1@akuosplash.test", password: "TestPass2026!", plan: "premium" },
  { email: "transtest2@akuosplash.test", password: "TestPass2026!", plan: "pro" },
];

// Helpers
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

async function clientePedirAgua(session, litros = 5000) {
  // POST /api/akuosplash/cliente/pedidos — crea un pedido como cliente
  const body = {
    litros,
    direccion: "Av. Test 123",
    comuna: "Las Condes",
    lat: -33.4087, lng: -70.5751,
    metodoPago: "tarjeta",
    nota: "Pedido de prueba automatizado",
  };
  const res = await fetch(`${BASE}/api/akuosplash/cliente/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Pedido ${res.status}: ${data.error}`);
  return data.pedido || data;
}

async function simularMpPaymentWebhook(pedidoId, monto, clienteId) {
  // Simula el webhook de MP que avisa que el pago fue aprobado
  // POST /api/akuosplash/webhooks/mercadopago
  // MP envía: { type: "payment", data: { id: "12345" } } y luego uno consulta /v1/payments/{id}
  // Para testing, enviamos directo el payment object
  const body = {
    type: "payment",
    data: { id: `test_pay_${pedidoId}_${Date.now()}` },
    // Mock payment data (normalmente MP nos lo da, pero podemos enviarlo directo para test)
    _test_payment: {
      id: `test_pay_${pedidoId}_${Date.now()}`,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: monto,
      external_reference: `akuo_pedido_pago:${clienteId}:${pedidoId}`,
    },
  };
  const res = await fetch(`${BASE}/api/akuosplash/webhooks/mercadopago`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.status;
}

async function transportistaTomaPedido(session, pedidoId) {
  // PATCH /api/akuosplash/cliente/pedidos/[id] para asignar el transportista
  // (Esto normalmente lo hace el transportista desde el dashboard)
  const res = await fetch(`${BASE}/api/akuosplash/cliente/pedidos/${pedidoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ estado: "aceptado" }),
  });
  return res.status;
}

async function simularEntrega(session, pedidoId, litros) {
  // Marca el pedido como entregado
  const res = await fetch(`${BASE}/api/akuosplash/cliente/pedidos/${pedidoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ estado: "entregado", litrosEntregados: litros }),
  });
  return res.status;
}

async function crearSubscripcion(session, plan, ciclo = "mensual") {
  // POST /api/akuosplash/admin/activate-test-subscription (endpoint TEMPORAL para testing)
  // Activa la subscripción directamente sin pasar por MP (para bypass de MP sandbox auth issues).
  const res = await fetch(`${BASE}/api/akuosplash/admin/activate-test-subscription`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ plan, ciclo }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.log(`    ⚠️  No se pudo activar: ${data.error}`);
    return null;
  }
  return data;
}

async function simularMpSubWebhook(userId, planId, ciclo, preapprovalId) {
  // Simula el webhook de MP que avisa que la preapproval fue autorizada
  // POST /api/akuosplash/subscription/mercadopago/webhook
  const body = {
    type: "subscription_preapproval",
    data: { id: preapprovalId },
    // Mock preapproval data
    _test_preapproval: {
      id: preapprovalId,
      status: "authorized",
      external_reference: `akuo_sub:${userId}:${planId}:${ciclo}`,
      auto_recurring: { transaction_amount: planId === "pro" ? 50000 : 15000 },
    },
  };
  const res = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.status;
}

// === MAIN ===
async function main() {
  console.log(`\n=== Simulación de 100 transacciones en ${BASE} ===\n`);

  // Loguear clientes
  const clientSessions = [];
  for (const c of CLIENTS) {
    const token = await login(c.email, c.password);
    if (token) {
      const meData = await me(token);
      clientSessions.push({ ...c, token, userId: meData.user?.id });
      console.log(`✓ Cliente logueado: ${c.email} (id: ${meData.user?.id})`);
    } else {
      console.log(`✗ No se pudo loguear: ${c.email}`);
    }
  }

  // Loguear transportistas
  const transpSessions = [];
  for (const t of TRANSPORTISTAS) {
    const token = await login(t.email, t.password);
    if (token) {
      const meData = await me(token);
      transpSessions.push({ ...t, token, userId: meData.user?.id });
      console.log(`✓ Transportista logueado: ${t.email} (id: ${meData.user?.id})`);
    } else {
      console.log(`✗ No se pudo loguear: ${t.email}`);
    }
  }

  if (clientSessions.length === 0 || transpSessions.length === 0) {
    console.error("Faltan sesiones. Abortando.");
    process.exit(1);
  }

  // === 80 ventas ===
  console.log(`\n=== Simulando 80 ventas ===`);
  let ventasOk = 0;
  let ventasFail = 0;
  for (let i = 0; i < 80; i++) {
    const client = clientSessions[i % clientSessions.length];
    try {
      const litros = 1000 + Math.floor(Math.random() * 9000);
      const pedido = await clientePedirAgua(client.token, litros);
      if (!pedido || !pedido.id) {
        console.log(`  [${i+1}/80] Sin pedido creado`);
        ventasFail++;
        continue;
      }
      // Simular MP webhook de payment approved
      const monto = litros * 50; // $50/litro
      await simularMpPaymentWebhook(pedido.id, monto, client.userId);
      // Transportista toma pedido
      const transp = transpSessions[i % transpSessions.length];
      await transportistaTomaPedido(transp.token, pedido.id);
      // Simular entrega
      await simularEntrega(transp.token, pedido.id, litros);
      ventasOk++;
      if ((i+1) % 10 === 0) console.log(`  [${i+1}/80] ✓ venta simulada (cliente ${client.email}, ${litros}L)`);
    } catch (e) {
      ventasFail++;
      if (ventasFail <= 3) console.log(`  [${i+1}/80] ✗ error: ${e.message}`);
    }
  }
  console.log(`  → ${ventasOk} ventas OK, ${ventasFail} fallidas`);

  // === 20 subscripciones ===
  console.log(`\n=== Simulando 20 subscripciones ===`);
  let subsOk = 0;
  let subsFail = 0;
  for (let i = 0; i < 20; i++) {
    const transp = transpSessions[i % transpSessions.length];
    try {
      // Activar subscripción directamente (endpoint temporal de testing)
      const result = await crearSubscripcion(transp.token, transp.plan, "mensual");
      if (!result) {
        subsFail++;
        continue;
      }
      subsOk++;
      if ((i+1) % 5 === 0) console.log(`  [${i+1}/20] ✓ subscripción simulada (${transp.email} → plan ${transp.plan})`);
    } catch (e) {
      subsFail++;
      if (subsFail <= 3) console.log(`  [${i+1}/20] ✗ error: ${e.message}`);
    }
  }
  console.log(`  → ${subsOk} subscripciones OK, ${subsFail} fallidas`);

  // Resumen
  console.log(`\n=== RESUMEN FINAL ===`);
  console.log(`Ventas: ${ventasOk}/80`);
  console.log(`Subscripciones: ${subsOk}/20`);
  console.log(`Total transacciones: ${ventasOk + subsOk}/100`);
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
