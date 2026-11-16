const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const APP_URL = "https://akuosplash.onrender.com";

(async () => {
  console.log(`ENV_TOKEN prefix=${ENV_TOKEN.slice(0,20)}...`);
  const mpBody = {
    reason: "AkuoSplash — TEST ENV-TOKEN (mensual)",
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 8000, currency_id: "CLP" },
    payer_email: "test_user_5921243736691050007@testuser.com",
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    status: "pending",
    external_reference: `akuo_sub:envtest:test:mensual`,
    notification_url: `${APP_URL}/api/akuosplash/subscription/mercadopago/webhook`,
  };
  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(mpBody),
  });
  const data = await res.json();
  console.log(`HTTP ${res.status}`);
  console.log(`application_id: ${data.application_id}`);
  console.log(`init_point: ${data.init_point}`);
  console.log(`¿tiene activation=true? ${String(data.init_point||"").includes("activation=true") ? "SÍ ❌" : "NO ✅"}`);
  console.log(`status: ${data.status}`);
  if (!res.ok) console.log(`err: ${JSON.stringify(data).slice(0,300)}`);
})().catch(e => console.error("ERROR:", e.message));
