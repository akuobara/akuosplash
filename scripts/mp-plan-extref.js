const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const APP_URL = "https://akuosplash.onrender.com";

(async () => {
  // Crear plan CON external_reference + metadata
  const planBody = {
    reason: "AkuoSplash — Plan test (mensual)",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 8000, currency_id: "CLP" },
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    external_reference: "akuo_sub:USERIDTEST:test:mensual",
    payment_methods_allowed: { payment_type_id: ["credit_card"], payment_method_id: ["visa", "master"] },
  };
  const pr = await fetch("https://api.mercadopago.com/preapproval_plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(planBody),
  });
  const pd = await pr.json();
  console.log(`Crear plan: HTTP ${pr.status}  id=${pd.id}`);
  console.log(`  external_reference guardada: ${pd.external_reference ?? "(undefined)"}`);
  console.log(`  init_point: ${pd.init_point}`);
  console.log(`  ¿activation=true? ${String(pd.init_point||"").includes("activation=true") ? "SÍ" : "NO ✅"}`);

  // GET del plan para confirmar
  const gr = await fetch(`https://api.mercadopago.com/preapproval_plan/${pd.id}`, {
    headers: { Authorization: `Bearer ${ENV_TOKEN}` },
  });
  const gd = await gr.json();
  console.log(`\nGET plan: HTTP ${gr.status}`);
  console.log(`  external_reference: ${gd.external_reference ?? "(undefined)"}`);
  console.log(`  status: ${gd.status}`);
  console.log(`  payment_methods_allowed: ${JSON.stringify(gd.payment_methods_allowed)}`);
})().catch(e => console.error("ERROR:", e.message));
