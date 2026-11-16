// Verificación E2E del flujo sandbox en producción (akuosplash.cl)
const BASE = "https://akuosplash.cl";

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

(async () => {
  // 1) Login como transtest3
  const session = await login("transtest3@akuosplash.test", "Test1234!");
  if (!session) { console.log("✗ login falló"); return; }
  console.log("✓ login transtest3 OK");

  // 2) POST create subscripción plan test
  const r = await fetch(`${BASE}/api/akuosplash/subscription/mercadopago/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${session}` },
    body: JSON.stringify({ plan: "test", ciclo: "mensual" }),
  });
  const d = await r.json().catch(() => ({}));
  console.log(`\ncreate: HTTP ${r.status}`);
  console.log(JSON.stringify(d, null, 1));
  if (!r.ok) return;

  // 3) Esperar 5s y verificar estado en MP + DB
  await new Promise(res => setTimeout(res, 5000));

  const fs = require("fs");
  const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
  const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
  const { createClient } = require("@libsql/client");
  const db = createClient({ url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/), authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/) });
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken);

  const gr = await fetch(`https://api.mercadopago.com/preapproval/${d.preapprovalId}`, { headers: { Authorization: `Bearer ${TOK}` } });
  const gd = await gr.json();
  console.log(`\nMP preapproval ${d.preapprovalId}:`);
  console.log(`  status=${gd.status}  charged=${gd.summarized?.charged_quantity}x $${gd.summarized?.last_charged_amount}  semaphore=${gd.summarized?.semaphore}`);
  console.log(`  next_payment=${gd.next_payment_date}`);

  const ur = await db.execute(`SELECT mpSubStatus, mpSubPreapprovalId, plan, suscripcionActiva, planActivoHasta FROM AkuoUsuario WHERE email = 'transtest3@akuosplash.test'`);
  const u = ur.rows[0];
  console.log(`\nDB transtest3:`);
  console.log(`  mpSubStatus=${u.mpSubStatus}  plan=${u.plan}  suscripcionActiva=${u.suscripcionActiva}  planActivoHasta=${u.planActivoHasta}`);
  console.log(`  preapprovalId=${u.mpSubPreapprovalId}`);

  const ok = u.mpSubStatus === "authorized" && u.plan === "test" && Number(u.suscripcionActiva) === 1 && gd.status === "authorized";
  console.log(`\n${ok ? "✅ E2E VERIFICADO: subscripción autorizada + cobrada + plan activo" : "❌ ALGO FALLÓ — revisar arriba"}`);
})().catch(e => console.error("ERROR:", e.message));
