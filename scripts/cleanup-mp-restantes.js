// Cancela TODAS las preapprovals authorized/pending restantes, con re-verificación.
// Uso: node scripts/cleanup-mp-restantes.js
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

  for (let intento = 1; intento <= 3; intento++) {
    let all = [];
    for (let off = 0; off < 500; off += 100) {
      const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=100&offset=${off}`, {
        headers: { Authorization: `Bearer ${TOK}` },
      });
      const d = await r.json();
      const res = d.results || d.elements || [];
      all = all.concat(res);
      if (res.length < 100) break;
    }
    const vivas = all.filter(p => p.status === "authorized" || p.status === "pending");
    console.log(`Intento ${intento}: ${all.length} totales, ${vivas.length} vivas`);
    if (vivas.length === 0) { console.log("✓ CERO preapprovals vivas — nada puede cobrar"); return; }
    for (const p of vivas) {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${p.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      console.log(`  ${r.ok ? "✓" : "✗"} ${p.id} (${p.status}) HTTP ${r.status}`);
    }
  }
  console.log("⚠️ Aún quedan preapprovals vivas tras 3 intentos");
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
