// Encuentra la(s) preapproval(es) viva(s) y muestra de quién es cada una.
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
  console.log(`Preapprovals vivas: ${vivas.length}\n`);
  for (const p of vivas) {
    const ar = p.auto_recurring || {};
    const ext = p.external_reference || "";
    const parts = ext.split(":");
    const userId = parts.length >= 2 ? parts[1] : null;
    console.log(`  id: ${p.id}`);
    console.log(`  status: ${p.status}  monto: $${ar.transaction_amount}  cobros: ${p.summarized?.charged_quantity}`);
    console.log(`  external_reference: ${ext}`);
    // buscar el usuario en la DB
    if (userId) {
      try {
        const ur = await db.execute({ sql: `SELECT email, plan, suscripcionActiva, mpSubStatus FROM AkuoUsuario WHERE id = ? LIMIT 1`, args: [userId] });
        const row = ur.rows[0];
        console.log(`  → usuario DB: ${row ? JSON.stringify(row) : "(no encontrado — posible usuario real borrado o id de test)"}`);
      } catch (e) { console.log(`  → lookup falló: ${e.message}`); }
    }
    console.log("");
  }
})().catch(e => console.error("ERR", e.message));
