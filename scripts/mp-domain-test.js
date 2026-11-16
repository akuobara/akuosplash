const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);

(async () => {
  for (const domain of ["https://akuosplash.cl", "https://akuosplash.onrender.com"]) {
    const mpBody = {
      reason: `AkuoSplash — TEST domain ${domain} (mensual)`,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 8000, currency_id: "CLP" },
      payer_email: "test_user_5921243736691050007@testuser.com",
      back_url: `${domain}/akuosplash/transportista?tab=subscripcion`,
      status: "pending",
      external_reference: `akuo_sub:domtest:test:mensual`,
      notification_url: `${domain}/api/akuosplash/subscription/mercadopago/webhook`,
    };
    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: { Authorization: `Bearer ${ENV_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(mpBody),
    });
    const data = await res.json();
    const hasAct = String(data.init_point||"").includes("activation=true");
    console.log(`\n=== dominio: ${domain} ===`);
    console.log(`  HTTP ${res.status}  application_id=${data.application_id}`);
    console.log(`  init_point: ${data.init_point}`);
    console.log(`  activation=true? ${hasAct ? "SÍ ❌" : "NO ✅"}`);
    console.log(`  notification_url devuelta: ${data.notification_url ?? "(undefined — rechazada)"}`);
  }
})().catch(e => console.error("ERROR:", e.message));
