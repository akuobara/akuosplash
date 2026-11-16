const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const token = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);

(async () => {
  // buscar todos los preapprovals (paginar)
  let all = [];
  let offset = 0;
  for (let i = 0; i < 5; i++) {
    const url = `https://api.mercadopago.com/preapproval/search?limit=100&offset=${offset}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const results = d.results || d.elements || [];
    if (!results.length) break;
    all = all.concat(results);
    offset += results.length;
    if (results.length < 100) break;
  }
  console.log(`Total preapprovals: ${all.length}\n`);
  // agrupar por frequency_type+frequency y status
  const agg = {};
  for (const p of all) {
    const ar = p.auto_recurring || {};
    const key = `${ar.frequency_type || "?"}/${ar.frequency || "?"}`;
    const st = p.status || "?";
    const amt = ar.transaction_amount;
    if (!agg[key]) agg[key] = { statuses: {}, amounts: [] };
    agg[key].statuses[st] = (agg[key].statuses[st] || 0) + 1;
    agg[key].amounts.push(`${amt}(${st[0]})`);
  }
  console.log("=== frequency_type/frequency → statuses + amounts ===");
  for (const [k, v] of Object.entries(agg)) {
    console.log(`  ${k}:  ${JSON.stringify(v.statuses)}  montos: ${v.amounts.join(", ").slice(0,120)}`);
  }
  // detalle de los daily
  console.log("\n=== preapprovals con frequency_type=days ===");
  for (const p of all.filter(p => p.auto_recurring?.frequency_type === "days")) {
    const ar = p.auto_recurring;
    console.log(`  ${p.id.slice(0,12)}  freq=${ar.frequency}days  amount=${ar.transaction_amount}  status=${p.status}  pm=${p.payment_method_id}`);
  }
})().catch(e => console.error("ERROR:", e.message));
