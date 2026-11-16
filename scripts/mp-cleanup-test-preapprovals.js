const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken);

  // Preapprovals de TEST creados durante debugging (NO tocar el E2E b45f4340 ni el del 9/11)
  const testIds = [
    "8c9144199c1842d5aba59ec68575530a", // flujo API manual de verificación
  ];
  for (const id of testIds) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    const d = await r.json();
    console.log(`cancel ${id}: HTTP ${r.status} → status=${d.status}`);
  }

  // Verificar estado final de todos los preapprovals authorized
  const sr = await fetch("https://api.mercadopago.com/preapproval/search?limit=20&sort=date_created&criteria=desc", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const sd = await sr.json();
  const arr = sd.results || sd.elements || [];
  console.log(`\n=== preapprovals recientes ===`);
  for (const p of arr) {
    console.log(`  ${p.id}  ${p.status}  ${p.date_created}  ${(p.reason||"").slice(0,40)}  charged=${p.summarized?.charged_quantity ?? "-"}`);
  }
})().catch(e => console.error("ERROR:", e.message));
