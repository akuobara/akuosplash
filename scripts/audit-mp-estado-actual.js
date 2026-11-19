// AUDITORÍA COMPLETA del estado actual — READ ONLY, no cambia nada.
// 1) DB: estado de los 3 transtest + config MP (a qué cuenta apunta) + planConfigs
// 2) MP API: /users/me del token, todos los preapprovals, todos los pagos
// Uso: node scripts/audit-mp-estado-actual.js

const fs = require("fs");
const { createClient } = require("@libsql/client");

const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const DB_URL = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const DB_AUTH = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url: DB_URL, authToken: DB_AUTH });

(async () => {
  console.log("═══════════════════════════════════════════════════════════");
  console.log(" AUDITORÍA MP — estado real, sin filtros");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── 1) Config MP en la DB ─────────────────────────────────
  const rc = await db.execute(`SELECT mpSubAccessToken, mpSplitAccessToken, mpSandbox, planConfigsJson
    FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const cfg = rc.rows[0] || {};
  const TOK = String(cfg.mpSubAccessToken || "");
  console.log("── 1) CONFIG MP en AkuoConfig (producción) ──");
  console.log("  mpSubAccessToken prefijo:", TOK.slice(0, 14) + "...");
  console.log("  mpSandbox flag:", cfg.mpSandbox);
  console.log("  (mpSplitAccessToken prefijo:", String(cfg.mpSplitAccessToken || "").slice(0, 14) + "...)\n");

  // ¿A qué cuenta MP pertenece ese token?
  const me = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const meD = await me.json();
  console.log("  → /users/me de ese token:");
  console.log("    user_id:", meD.id, "| nickname:", meD.nickname);
  console.log("    email:", meD.email, "| is_test:", meD.is_test);
  console.log("");

  // ── 2) Estado de los 3 transtest en la DB ─────────────────
  console.log("── 2) USUARIOS transtest1/2/3 en la DB ──");
  const ru = await db.execute(`SELECT email, plan, suscripcionActiva, planActivoHasta,
    mpSubStatus, mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo, mpSubAmount,
    mpTestUserEmail, mpSubAutorizadoEn
    FROM AkuoUsuario WHERE email LIKE 'transtest%@akuosplash.test' ORDER BY email`);
  for (const u of ru.rows) {
    console.log(`  ${u.email}`);
    console.log(`    plan=${u.plan}  suscripcionActiva=${u.suscripcionActiva}  hasta=${u.planActivoHasta || "-"}`);
    console.log(`    mpSub: status=${u.mpSubStatus}  solicitado=${u.mpSubPlanSolicitado}  ciclo=${u.mpSubCiclo}  monto=${u.mpSubAmount}`);
    console.log(`    preapprovalId=${u.mpSubPreapprovalId}  autorizadoEn=${u.mpSubAutorizadoEn || "-"}`);
    console.log(`    mpTestUserEmail=${u.mpTestUserEmail || "-"}`);
  }
  console.log("");

  // ── 3) planConfigs: ¿qué planes existen y a qué precio? ──
  console.log("── 3) PLANES configurados (planConfigsJson) ──");
  try {
    const parsed = JSON.parse(cfg.planConfigsJson || "{}");
    for (const [id, p] of Object.entries(parsed)) {
      console.log(`  ${id}: "${p.nombre}"  mensual=$${p.precioMensual} anual=$${p.precioAnual} activa=${p.activa}`);
    }
  } catch (e) { console.log("  (sin planConfigsJson legible)"); }
  console.log("");

  // ── 4) TODOS los preapprovals en MP (paginado) ────────────
  console.log("── 4) PREAPPROVALS en la cuenta MP del token ──");
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
  console.log(`  Total: ${all.length}`);
  const porStatus = {};
  for (const p of all) porStatus[p.status] = (porStatus[p.status] || 0) + 1;
  console.log("  Por status:", JSON.stringify(porStatus));
  // Detalle de los authorized (los que pueden seguir cobrando)
  const auth = all.filter(p => p.status === "authorized");
  console.log(`  → AUTHORIZED (siguen cobrando cada ciclo): ${auth.length}`);
  for (const p of auth) {
    const ar = p.auto_recurring || {};
    console.log(`    ${p.id}  $${ar.transaction_amount}/${ar.frequency} ${ar.frequency_type}  cobros:${p.summarized?.charged_quantity ?? "?"}  total:$${p.summarized?.charged_amount ?? "?"}  ext_ref=${(p.external_reference || "-").slice(0, 60)}`);
  }
  console.log("");

  // ── 5) TODOS los pagos (cobros reales ejecutados) ─────────
  console.log("── 5) PAGOS ejecutados en esa cuenta MP (search) ──");
  let pays = [];
  for (let off = 0; off < 500; off += 50) {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/search?limit=50&offset=${off}&sort=date_created&criteria=desc`, {
      headers: { Authorization: `Bearer ${TOK}` },
    });
    const d = await r.json();
    const res = d.results || d.elements || [];
    pays = pays.concat(res);
    if (res.length < 50) break;
  }
  console.log(`  Total pagos encontrados: ${pays.length}`);
  let totalCLP = 0, aprobados = 0;
  for (const p of pays) {
    const marca = p.status === "approved" ? "APROBADO" : p.status;
    if (p.status === "approved") { totalCLP += Number(p.transaction_amount || 0); aprobados++; }
    console.log(`    id=${p.id}  ${p.date_created}  ${marca}  $${p.transaction_amount}  "${(p.description || "").slice(0, 50)}"`);
  }
  console.log(`\n  → COBROS APROBADOS: ${aprobados}  por un total de $${totalCLP} CLP`);
  console.log("    (en la cuenta MP:", meD.nickname, "— is_test:", meD.is_test + ")");

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(" FIN AUDITORÍA (no se cambió nada)");
  console.log("═══════════════════════════════════════════════════════════");
})().catch(e => { console.error("ERR:", e.message); process.exit(1); });
