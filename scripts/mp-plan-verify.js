const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const ENV_TOKEN = grab(/"key":\s*"AKUO_MP_ACCESS_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

(async () => {
  // 1) Ver qué token usa producción (getMpSubCreds: AkuoConfig.mpSubAccessToken)
  const r = await db.execute(`SELECT mpSubAccessToken, mpSubPublicKey, mpSandbox FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  let DB_TOKEN = null;
  for (const row of r.rows) {
    DB_TOKEN = String(row.mpSubAccessToken || "") || null;
    console.log(`AkuoConfig: mpSubAccessToken=${DB_TOKEN ? DB_TOKEN.slice(0,20) + "..." : "(null)"}  mpSandbox=${row.mpSandbox}`);
  }
  if (!DB_TOKEN) console.log("AkuoConfig: mpSubAccessToken vacío → producción caería a env AKUO_MP_ACCESS_TOKEN");
  console.log(`\nDB_TOKEN prefix: ${DB_TOKEN ? DB_TOKEN.slice(0,24) : "(no encontrado)"}`);

  // 2) Estado actual del usuario transtest3 (o el que esté pending)
  const ru = await db.execute(`SELECT id, email, mpSubStatus, mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo, mpSubIniciadoEn, mpSubAmount FROM AkuoUsuario WHERE mpSubPreapprovalId IS NOT NULL ORDER BY mpSubIniciadoEn DESC LIMIT 3`);
  for (const row of ru.rows) {
    console.log(`\nusuario: ${row.email}  status=${row.mpSubStatus}  planSolicitado=${row.mpSubPlanSolicitado}  iniciado=${row.mpSubIniciadoEn}`);
    console.log(`  mpSubPreapprovalId=${row.mpSubPreapprovalId}`);
  }

  // 3) Buscar PLANES recientes con el token que usa producción (y con el del env para comparar)
  const tokens = [["DB", DB_TOKEN], ["ENV", ENV_TOKEN]].filter(t => t[1]);
  for (const [name, tok] of tokens) {
    try {
      const res = await fetch("https://api.mercadopago.com/preapproval_plan/search?limit=5&sort=date_created&criteria=desc", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const d = await res.json();
      const arr = d.results || d.elements || [];
      console.log(`\n=== PLANES (${name} token, app ${tok.slice(8,24)}) — ${arr.length} recientes ===`);
      for (const p of arr.slice(0, 5)) {
        console.log(`  plan=${p.id}  creado=${p.date_created}  status=${p.status}`);
        console.log(`    reason=${(p.reason||"").slice(0,50)}  ext_ref=${p.external_reference || "(ninguna)"}`);
        console.log(`    payment_methods_allowed=${JSON.stringify(p.payment_methods_allowed)}`);
        console.log(`    init_point=${(p.init_point||"").slice(0,90)}`);
      }
    } catch (e) { console.log(`${name}: error ${e.message}`); }
  }
})().catch(e => console.error("ERROR:", e.message));
