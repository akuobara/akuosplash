const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  // Token que usa producción
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken);
  console.log(`token: ${TOK.slice(0, 24)}...`);

  // 1) Estado de transtest3 y planes creados después del deploy (02:44 UTC)
  const ru = await db.execute(`SELECT id, email, mpSubStatus, mpSubPreapprovalId, mpSubPlanSolicitado, mpSubIniciadoEn, mpSubAmount FROM AkuoUsuario WHERE email LIKE 'transtest%' OR email LIKE 'transportistatest%'`);
  for (const row of ru.rows) {
    console.log(`\nusuario ${row.email}: status=${row.mpSubStatus} preapproval=${row.mpSubPreapprovalId} plan=${row.mpSubPlanSolicitado} amount=${row.mpSubAmount} iniciado=${row.mpSubIniciadoEn}`);
  }

  // 2) PREAPPROVALS (no planes) recientes en MP — ¿se creó alguno? ¿en qué estado?
  const res = await fetch("https://api.mercadopago.com/preapproval/search?limit=10&sort=date_created&criteria=desc", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const d = await res.json();
  const arr = d.results || d.elements || [];
  console.log(`\n=== PREAPPROVALS recientes (${arr.length}) ===`);
  for (const p of arr) {
    console.log(`  id=${p.id}  creado=${p.date_created}  status=${p.status}  payer=${(p.payer_email||"").slice(0,35)}`);
    console.log(`    reason=${(p.reason||"").slice(0,45)}  plan_id=${p.preapproval_plan_id || "(inline)"}  external_ref=${p.external_reference||"-"}`);
    console.log(`    next_payment=${p.next_payment_date || "-"}  auto_recurring=${JSON.stringify(p.auto_recurring||{}).slice(0,120)}`);
  }

  // 3) Detalle del preapproval autorizado del 9/11 para comparar
  const r911 = await fetch("https://api.mercadopago.com/preapproval/e2b7227628234a808853884e8f202a41", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const p911 = await r911.json();
  console.log(`\n=== PREAPPROVAL 9/11 (referencia exitosa) ===`);
  console.log(JSON.stringify({ status: p911.status, payer_email: p911.payer_email, card: p911.card_id, payment_method: p911.payment_method_id, auto_recurring: p911.auto_recurring, back_url: p911.back_url, external_reference: p911.external_reference, reason: p911.reason, modified: p911.date_last_updated }, null, 1));

  // 4) Planes creados después del deploy 02:44 UTC (23:44 CLT del 15/11)
  const pr = await fetch("https://api.mercadopago.com/preapproval_plan/search?limit=10&sort=date_created&criteria=desc", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const pd = await pr.json();
  const plans = pd.results || pd.elements || [];
  console.log(`\n=== PLANES: los 3 más recientes ===`);
  for (const p of plans.slice(0, 3)) {
    console.log(`  plan=${p.id} creado=${p.date_created} amount=${p.auto_recurring?.transaction_amount} freq=${p.auto_recurring?.frequency}/${p.auto_recurring?.frequency_type}`);
  }
})().catch(e => console.error("ERROR:", e.message));
