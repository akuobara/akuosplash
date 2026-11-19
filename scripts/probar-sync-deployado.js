// Prueba el /sync DEPLOYADO en akuosplash.cl: login transtest3 → GET /sync → verificar plan.
// El /sync VIEJO devuelve error (GET /preapproval/<plan_id> = 404).
// El /sync NUEVO (mi fix) busca por preapproval_plan_id → encuentra authorized → activa plan.
const BASE = "https://akuosplash.cl";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function login(email, password) {
  const res = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie") || "";
  const m = setCookie.match(/akuosplash_session=([^;]+)/);
  return m ? m[1] : null;
}

(async () => {
  const session = await login("transtest3@akuosplash.test", "Test1234!");
  if (!session) { console.log("✗ login falló"); return; }

  // Estado ANTES
  const infoAntes = await (await fetch(`${BASE}/api/akuosplash/subscription/info`, {
    headers: { Cookie: `akuosplash_session=${session}` },
  })).json();
  console.log("ANTES /sync:", JSON.stringify({ plan: infoAntes.subscripcion?.plan, mpSubStatus: infoAntes.subscripcion?.mpSubStatus }));

  // GET /sync
  const syncRes = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/sync`, {
    headers: { Cookie: `akuosplash_session=${session}` },
  });
  const syncBody = await syncRes.json();
  console.log(`\nGET /sync → HTTP ${syncRes.status}`);
  console.log("Respuesta:", JSON.stringify(syncBody));

  // Estado DESPUÉS
  const infoDespues = await (await fetch(`${BASE}/api/akuosplash/subscription/info?_t=${Date.now()}`, {
    headers: { Cookie: `akuosplash_session=${session}` },
  })).json();
  console.log("\nDESPUÉS /sync:", JSON.stringify({ plan: infoDespues.subscripcion?.plan, mpSubStatus: infoDespues.subscripcion?.mpSubStatus, suscripcionActiva: infoDespues.subscripcion?.suscripcionActiva }));

  console.log("\n════ VEREDICTO ════");
  if (syncBody.ok && syncBody.status === "authorized" && infoDespues.subscripcion?.plan === "premium") {
    console.log("✓ /sync DEPLOYADO FUNCIONA: encontró la preapproval por preapproval_plan_id y activó premium.");
  } else if (syncBody.error && String(syncBody.error).includes("404")) {
    console.log("⏳ Deploy aún no terminó — /sync VIEJO (GET /preapproval/<plan_id> = 404). Reintentar en ~1 min.");
  } else {
    console.log("? Respuesta intermedia. Ver arriba.");
  }
})().catch(e => console.error("ERR", e.message));
