const { createClient } = require("@libsql/client");
const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url: dbUrl, authToken: dbAuth });
const TOK = ENV_TOKEN; // mismo collector, token válido

(async () => {
  // 1) listar TODOS los preapprovals con sus datos clave
  let offset = 0;
  const all = [];
  while (true) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=50&offset=${offset}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const arr = d.results || d.elements || [];
    if (!arr.length) break;
    all.push(...arr);
    if (arr.length < 50) break;
    offset += 50;
  }
  console.log(`Total preapprovals: ${all.length}`);
  const byStatus = {};
  for (const p of all) byStatus[p.status] = (byStatus[p.status]||0)+1;
  console.log(`Por estado: ${JSON.stringify(byStatus)}`);

  // 2) encontrar el AUTHORIZED + uno pending reciente
  const authorized = all.filter(p => p.status === "authorized");
  const pending = all.filter(p => p.status === "pending").sort((a,b) => new Date(b.date_created||0) - new Date(a.date_created||0));
  console.log(`\nauthorized: ${authorized.length}  pending: ${pending.length}`);
  console.log(`\nauthorized IDs: ${authorized.map(p=>p.id).join(", ")}`);
  console.log(`pending (top 3 recientes): ${pending.slice(0,3).map(p=>p.id).join(", ")}`);

  // 3) GET completo del primer authorized + del pending más reciente
  const pickA = authorized[0];
  const pickP = pending[0];
  if (!pickA || !pickP) { console.log("Falta uno de los dos para comparar"); return; }

  const [rA, rP] = await Promise.all([
    fetch(`https://api.mercadopago.com/preapproval/${pickA.id}`, { headers: { Authorization: `Bearer ${TOK}` } }),
    fetch(`https://api.mercadopago.com/preapproval/${pickP.id}`, { headers: { Authorization: `Bearer ${TOK}` } }),
  ]);
  const A = await rA.json();
  const P = await rP.json();

  console.log(`\n========== COMPARACIÓN ==========`);

  // campos relevantes lado a lado
  const campos = [
    "status", "reason", "external_reference", "payer_email", "payer_id",
    "date_created", "last_modified",
    "auto_recurring.frequency", "auto_recurring.frequency_type",
    "auto_recurring.transaction_amount", "auto_recurring.currency_id",
    "auto_recurring.start_date", "auto_recurring.end_date",
    "auto_recurring.has_billing_day", "auto_recurring.billing_day",
    "auto_recurring.free_trial",
    "payment_method_id", "card_token_id",
    "back_url", "notification_url",
    "init_point", "sandbox_init_point",
  ];
  const get = (o, path) => path.split(".").reduce((x,k) => (x==null?undefined:x[k]), o);
  console.log("\nCampo | AUTHORIZED | PENDING");
  for (const c of campos) {
    const va = JSON.stringify(get(A, c));
    const vp = JSON.stringify(get(P, c));
    const diff = va === vp ? "" : "  ⚠️ DIFF";
    console.log(`${c} | ${va} | ${vp}${diff}`);
  }

  // guardar ambos completos
  fs.writeFileSync("/home/z/my-project/scripts/mp-prep-authorized.json", JSON.stringify(A, null, 2));
  fs.writeFileSync("/home/z/my-project/scripts/mp-prep-pending.json", JSON.stringify(P, null, 2));
  console.log("\n(guardados completos en scripts/mp-prep-authorized.json y mp-prep-pending.json)");
})().catch(e => console.error("ERROR:", e.message));
