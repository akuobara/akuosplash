const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const APP_URL = "https://akuosplash.onrender.com";

(async () => {
  // 1) Crear preapproval_plan
  const planBody = {
    reason: "AkuoSplash — Plan test (mensual) [PLAN]",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 8000, currency_id: "CLP" },
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    payment_methods_allowed: { payment_type_id: ["credit_card"], payment_method_id: ["visa", "master"] },
  };
  console.log("=== POST /preapproval_plan ===");
  const pr = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(planBody),
  });
  const pd = await pr.json();
  console.log(`HTTP ${pr.status}  plan_id=${pd.id}`);
  if (!pr.ok) { console.log(`err: ${JSON.stringify(pd).slice(0,400)}`); return; }
  console.log(`plan init_point: ${pd.init_point}`);

  // 2) Crear preapproval referenciando el plan
  const preBody = {
    preapproval_plan_id: pd.id,
    reason: "AkuoSplash — Plan test (mensual)",
    payer_email: "test_user_5921243736691050007@testuser.com",
    card_token_id: undefined, // sin tarjeta — el checkout la pide
    status: "pending",
    external_reference: `akuo_sub:plantest:test:mensual`,
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    notification_url: `${APP_URL}/api/akuosplash/subscription/mercadopago/webhook`,
  };
  console.log("\n=== POST /preapproval (con preapproval_plan_id) ===");
  const rr = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(preBody),
  });
  const rd = await rr.json();
  console.log(`HTTP ${rr.status}  id=${rd.id}  status=${rd.status}`);
  console.log(`application_id=${rd.application_id}`);
  console.log(`init_point: ${rd.init_point}`);
  console.log(`¿activation=true? ${String(rd.init_point||"").includes("activation=true") ? "SÍ ❌" : "NO ✅"}`);
  console.log(`notification_url devuelta: ${rd.notification_url ?? "(undefined)"}`);
  console.log(`auto_recurring: ${JSON.stringify(rd.auto_recurring)}`);
  if (!rr.ok) console.log(`err: ${JSON.stringify(rd).slice(0,400)}`);
})().catch(e => console.error("ERROR:", e.message));
