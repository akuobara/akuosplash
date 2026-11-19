// Cancela TODAS las preapprovals vivas (authorized/pending) en la cuenta MP de test.
// Acción única autorizada por el usuario. No toca DB, no llama otros endpoints.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");
  const api = "https://api.mercadopago.com";

  // 1) Listar TODAS las preapprovals (vivas y canceladas) para ver el panorama completo
  let todas = [];
  for (let off = 0; off < 1000; off += 100) {
    const r = await fetch(`${api}/preapproval/search?limit=100&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    todas = todas.concat(res);
    if (res.length < 100) break;
  }
  console.log(`Total preapprovals en la cuenta MP: ${todas.length}`);

  // 2) Filtrar las VIVAS (authorized o pending) — esas son las que cobran
  const vivas = todas.filter(p => p.status === "authorized" || p.status === "pending");
  console.log(`Vivas (authorized/pending): ${vivas.length}\n`);

  if (vivas.length === 0) {
    console.log("No hay nada que cancelar. Cuenta limpia.");
    return;
  }

  // 3) Cancelar cada una
  let ok = 0, fail = 0;
  for (const p of vivas) {
    const ar = p.auto_recurring || {};
    const r = await fetch(`${api}/preapproval/${p.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const st = r.status;
    if (st === 200) ok++; else fail++;
    console.log(`  ${p.id}  ${p.status}→cancelled  $${ar.transaction_amount}  HTTP ${st}  ${(p.external_reference || "").slice(0, 45)}`);
  }

  // 4) Esperar a que el índice de search se actualice y re-verificar con GET directo
  await new Promise(r => setTimeout(r, 3000));
  let vivasTras = 0;
  for (const p of vivas) {
    const g = await fetch(`${api}/preapproval/${p.id}`, { headers: { Authorization: `Bearer ${TOK}` } });
    const d = await g.json();
    if (d.status === "authorized" || d.status === "pending") vivasTras++;
  }
  console.log(`\nCanceladas: ${ok} OK, ${fail} fallaron`);
  console.log(`Vivas restantes (verificado con GET directo a MP): ${vivasTras}`);
  console.log(vivasTras === 0 ? "✓ Todas canceladas. Ninguna preapproval viva puede cobrar." : "✗ Aún hay vivas — revisar las que fallaron arriba");
})().catch(e => console.error("ERR", e.message));
