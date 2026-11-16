const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const token = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
if (!token) { console.error("sin token MP"); process.exit(1); }
console.log(`token len=${token.length} prefix=${token.slice(0,8)}`);

const PREAP_IDS = [
  ["transtest3 (diario, pending)", "34e3d78ccd2240b79ad9e85963fd707d"],
  ["transportistatest (mensual, authorized)", "e2b7227628234a808853884e8f202a41"],
  ["transtest1 (mensual, authorized)", "test_preapproval_cmvd67dmq0001n502nabv1bcd_1792290201335"],
];

(async () => {
  for (const [label, id] of PREAP_IDS) {
    console.log(`\n=== ${label} ===  id=${id}`);
    const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    if (!data || data.error || r.status !== 200) { console.log(`  HTTP ${r.status}: ${JSON.stringify(data).slice(0,300)}`); continue; }
    const ar = data.auto_recurring || {};
    console.log(`  status=${data.status}  payer_email=${JSON.stringify(data.payer_email)}  payer_id=${data.payer_id}`);
    console.log(`  freq=${ar.frequency} ${ar.frequency_type}  amount=${ar.transaction_amount} ${ar.currency_id}`);
    console.log(`  payment_method_id=${data.payment_method_id}  next_payment_date=${data.next_payment_date || "(n/a)"}`);
  }
})().catch(e => console.error("ERROR:", e.message));
