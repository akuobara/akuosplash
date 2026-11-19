// CLEANUP COMPLETO del desastre de testing:
// 1) Cancela TODAS las preapprovals activas (authorized/pending) en MP — así no sigue cobrando nada
// 2) Resetea transtest1/2/3 en la DB (plan gratis, sin subscripción)
// 3) Quita el plan "test" ($8.000) de planConfigsJson — era un plan de debug, no del producto
// 4) Muestra el estado final. Todo con output crudo.
// Uso: node scripts/cleanup-mp-desastre.js

const fs = require("fs");
const { createClient } = require("@libsql/client");

const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const DB_URL = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const DB_AUTH = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url: DB_URL, authToken: DB_AUTH });

(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" CLEANUP MP — cancela TODO y resetea usuarios de prueba");
  console.log("═══════════════════════════════════════════════════════════\n");

  const rc = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = String(rc.rows[0].mpSubAccessToken || "");

  // ── 1) Cancelar TODAS las preapprovals authorized/pending en MP ──
  console.log("── 1) Cancelando preapprovals en MP ──");
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
  console.log(`  Encontradas: ${all.length}`);
  let canceladas = 0;
  for (const p of all) {
    if (p.status === "authorized" || p.status === "pending") {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${p.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", reason: p.reason || "cleanup" }),
      });
      const ok = r.ok;
      if (ok) canceladas++;
      console.log(`  ${ok ? "✓" : "✗"} ${p.id}  (${p.status} → cancelled)  $${p.auto_recurring?.transaction_amount}  ext_ref=${(p.external_reference || "-").slice(0, 55)}`);
    }
  }
  console.log(`  → Canceladas: ${canceladas}\n`);

  // ── 2) Resetear transtest1/2/3 ──
  console.log("── 2) Resetear transtest1/2/3 en la DB ──");
  const rr = await db.execute(`UPDATE AkuoUsuario SET
    plan = 'gratis', suscripcionActiva = 0, planActivoDesde = NULL, planActivoHasta = NULL,
    mpSubPreapprovalId = NULL, mpSubPlanSolicitado = NULL, mpSubCiclo = NULL,
    mpSubStatus = NULL, mpSubIniciadoEn = NULL, mpSubAutorizadoEn = NULL, mpSubAmount = NULL
    WHERE email LIKE 'transtest%@akuosplash.test'`);
  console.log(`  → ${rr.rowsAffected} usuarios reseteados a plan gratis\n`);

  // ── 3) Quitar plan "test" de planConfigsJson ──
  console.log("── 3) Quitar plan 'test' de planConfigsJson ──");
  const rcfg = await db.execute(`SELECT planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  let configs = JSON.parse(rcfg.rows[0].planConfigsJson || "{}");
  const antes = Object.keys(configs).join(", ");
  delete configs.test; // plan de debug $8.000 — no es del producto
  const rUpd = await db.execute({
    sql: `UPDATE AkuoConfig SET planConfigsJson = ? WHERE activo = 1`,
    args: [JSON.stringify(configs)],
  });
  console.log(`  Antes: [${antes}]`);
  console.log(`  Ahora: [${Object.keys(configs).join(", ")}] (${rUpd.rowsAffected} fila actualizada)\n`);

  // ── 4) Verificación final ──
  console.log("── 4) ESTADO FINAL ──");
  const rv = await db.execute(`SELECT email, plan, suscripcionActiva, mpSubStatus FROM AkuoUsuario WHERE email LIKE 'transtest%@akuosplash.test' ORDER BY email`);
  for (const u of rv.rows) console.log(`  ${u.email}: plan=${u.plan} activa=${u.suscripcionActiva} mpSubStatus=${u.mpSubStatus || "-"}`);

  let all2 = [];
  for (let off = 0; off < 500; off += 100) {
    const r = await fetch(`https://api.mercadopago.com/preapproval/search?limit=100&offset=${off}`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    all2 = all2.concat(res);
    if (res.length < 100) break;
  }
  const porStatus2 = {};
  for (const p of all2) porStatus2[p.status] = (porStatus2[p.status] || 0) + 1;
  console.log(`\n  MP preapprovals ahora: ${JSON.stringify(porStatus2)}`);
  const vivas = all2.filter(p => p.status === "authorized" || p.status === "pending");
  console.log(`  → Preapprovals que pueden cobrar: ${vivas.length} ${vivas.length === 0 ? "✓ (cero)" : "✗ AÚN HAY"}`);

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(" CLEANUP LISTO");
  console.log("═══════════════════════════════════════════════════════════");
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
