const { createClient } = require("@libsql/client");
const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const url = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const authToken = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url, authToken });
const APP_URL = "https://akuosplash.onrender.com";

(async () => {
  // 1) creds + payer email + plan test
  const cfg = await db.execute(`SELECT mpSubAccessToken, mpSandbox FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = cfg.rows[0].mpSubAccessToken;
  const u = await db.execute(`SELECT id, email, mpTestUserEmail FROM AkuoUsuario WHERE email LIKE 'transtest%' LIMIT 1`);
  const usuario = u.rows[0];
  const payerEmail = usuario.mpTestUserEmail || usuario.email;
  console.log(`usuario: ${usuario.email}  payer_email=${payerEmail}  tokenPrefix=${TOK.slice(0,12)}`);

  // plan "test" precio mensual
  const pc = await db.execute(`SELECT id, nombre, precioMensual FROM AkuoPlanConfig WHERE id = 'test' LIMIT 1`);
  const planCfg = pc.rows[0] || { id: "test", nombre: "Test", precioMensual: 1000 };
  const amount = Number(planCfg.precioMensual) || 1000;
  console.log(`plan: ${planCfg.id} (${planCfg.nombre})  mensual=$${amount}`);

  // 2) crear preapproval mensual EXACTO como el route
  const mpBody = {
    reason: `AkuoSplash — Plan ${planCfg.nombre} (mensual)`,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: amount, currency_id: "CLP" },
    payer_email: payerEmail,
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    status: "pending",
    external_reference: `akuo_sub:${usuario.id}:test:mensual`,
    notification_url: `${APP_URL}/api/akuosplash/subscription/mercadopago/webhook`,
  };
  console.log("\n=== POST /preapproval payload ===");
  console.log(JSON.stringify(mpBody, null, 2));

  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify(mpBody),
  });
  const data = await res.json();
  console.log(`\n=== MP response: HTTP ${res.status} ===`);
  console.log(`id: ${data.id}`);
  console.log(`status: ${data.status}`);
  console.log(`init_point: ${data.init_point}`);
  console.log(`sandbox_init_point: ${data.sandbox_init_point}`);
  console.log(`auto_recurring: ${JSON.stringify(data.auto_recurring)}`);
  console.log(`payer_email: ${data.payer_email}`);
  if (!res.ok) console.log(`ERROR full: ${JSON.stringify(data).slice(0, 400)}`);

  const checkoutUrl = data.sandbox_init_point || data.init_point;
  if (checkoutUrl) {
    console.log(`\n=== Fetch checkout URL (primeros 600 chars de texto) ===`);
    const cf = await fetch(checkoutUrl, { redirect: "follow" });
    console.log(`HTTP ${cf.status}  finalURL=${cf.url}`);
    const html = await cf.text();
    // extraer título y textos clave
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    console.log(`title: ${title ? title[1].trim() : "(none)"}`);
    // buscar mensajes relevantes
    const keywords = ["tarjeta", "saldo", "confirmar", "suscripción", "error", "medio de pago", "dinero", "ingresá", "pagar", "recurring", "card"];
    for (const k of keywords) {
      const idx = html.toLowerCase().indexOf(k);
      if (idx >= 0) console.log(`  '${k}' @${idx}: ...${html.slice(Math.max(0,idx-30), idx+80).replace(/\s+/g," ")}...`);
    }
    console.log(`\nhtml length: ${html.length}`);
    // guardar para inspección
    fs.writeFileSync("/home/z/my-project/scripts/mp-checkout.html", html);
    console.log("(html guardado en scripts/mp-checkout.html)");
  }
})().catch(e => console.error("ERROR:", e.message));
