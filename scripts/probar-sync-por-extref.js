// PRUEBA el enfoque sync-por-external_reference (no necesita webhook ni panel).
// Replica lo que haría /create (producción) + un pago real + /sync arreglado.
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
  const api = "https://api.mercadopago.com";
  const u = (await db.execute(`SELECT id FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  const userId = u.id;
  const extRef = `akuo_sub:${userId}:premium:mensual`;

  // ── ESTADO ANTES ──
  const antes = (await db.execute(`SELECT plan, mpSubStatus, suscripcionActiva FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("ANTES:", JSON.stringify(antes));

  // ── PASO 1: simular /create (camino producción) — crea preapproval_plan, guarda plan_id ──
  const ct = await (await fetch(`${api}/v1/card_tokens`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ card_number: "5416752602582580", security_code: "123", expiration_month: 11, expiration_year: 2030, cardholder: { name: "APRO" } }),
  })).json();

  const pl = await (await fetch(`${api}/preapproval_plan`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      reason: "AkuoSplash — Plan Premium (mensual)",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 7990, currency_id: "CLP" },
      external_reference: extRef,
      back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    }),
  })).json();
  console.log("\n[1] /create simulado: plan_id guardado en DB =", pl.id);

  // Guardar como lo hace /create producción: plan_id como mpSubPreapprovalId, status pending
  await db.execute({
    sql: `UPDATE AkuoUsuario SET mpSubPreapprovalId=?, mpSubPlanSolicitado='premium', mpSubCiclo='mensual', mpSubStatus='pending', mpSubAmount=7990, plan='gratis', suscripcionActiva=0 WHERE id=?`,
    args: [pl.id, userId],
  });

  // ── PASO 2: simular "usuario pagó" — MP crea preapproval real (con test card) ──
  const pre = await (await fetch(`${api}/preapproval`, {
    method: "POST", headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      preapproval_plan_id: pl.id, reason: "AkuoSplash — Plan Premium (mensual)",
      payer_email: "test_user_2094743021490827193@testuser.com", card_token_id: ct.id,
      external_reference: extRef, back_url: "https://akuosplash.cl/akuosplash/transportista?tab=subscripcion",
    }),
  })).json();
  console.log("[2] Pago simulado: MP creó preapproval", pre.id, "status:", pre.status, "(id DIFERENTE del plan_id — por eso /sync actual falla)");

  // ── PASO 3: /sync ARREGLADO — buscar por external_reference, no por mpSubPreapprovalId ──
  console.log("\n[3] /sync arreglado: GET /preapproval/search filtrando por external_reference...");
  let encontrada = null;
  for (let off = 0; off < 500; off += 50) {
    const r = await fetch(`${api}/preapproval/search?limit=50&offset=${off}`, { headers: { Authorization: `Bearer ${TOK}` } });
    const d = await r.json();
    const res = d.results || d.elements || [];
    const match = res.find(p => p.external_reference === extRef && p.status === "authorized");
    if (match) { encontrada = match; break; }
    if (res.length < 50) break;
  }
  if (!encontrada) {
    // fallback: buscar por q param
    const r2 = await fetch(`${api}/preapproval/search?q=${encodeURIComponent(extRef)}`, { headers: { Authorization: `Bearer ${TOK}` } });
    const d2 = await r2.json();
    const res2 = d2.results || d2.elements || [];
    encontrada = res2.find(p => p.external_reference === extRef && p.status === "authorized");
  }
  if (!encontrada) {
    console.log("✗ /sync no encontró preapproval autorizada por external_reference");
    return;
  }
  console.log("    Encontrada:", encontrada.id, "status:", encontrada.status, "monto: $", encontrada.auto_recurring?.transaction_amount);

  // Activar el plan (lo que /sync haría)
  const ahora = new Date();
  const fin = new Date(ahora); fin.setMonth(fin.getMonth() + 1);
  await db.execute({
    sql: `UPDATE AkuoUsuario SET plan='premium', mpSubStatus='authorized', mpSubPreapprovalId=?, mpSubAutorizadoEn=?, suscripcionActiva=1, planActivoDesde=?, planActivoHasta=? WHERE id=?`,
    args: [encontrada.id, ahora.toISOString(), ahora.toISOString(), fin.toISOString(), userId],
  });

  const despues = (await db.execute(`SELECT plan, mpSubStatus, mpSubPreapprovalId, suscripcionActiva, mpSubAmount, planActivoHasta FROM AkuoUsuario WHERE email='transtest3@akuosplash.test'`)).rows[0];
  console.log("\nDESPUÉS:", JSON.stringify(despues));
  console.log("\n════ VEREDICTO ════");
  console.log(despues.plan === "premium" && despues.suscripcionActiva == 1
    ? "✓ SYNC POR EXTERNAL_REFERENCE FUNCIONA. El plan se activó sin webhook, sin panel."
    : "✗ Falló");
  console.log("\n→ Fix concreto: cambiar /sync para buscar por external_reference en vez de /preapproval/<mpSubPreapprovalId>.");
})().catch(e => console.error("ERR", e.message));
