const { createClient } = require("@libsql/client");
const fs = require("fs");

// leer credenciales de create-render-service.py (plaintext ahí)
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const url = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const authToken = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
if (!url || !authToken) { console.error("no pude extraer credenciales"); process.exit(1); }
console.log(`url len=${url.length} startsLibsql=${url.startsWith("libsql")} token len=${authToken.length}`);

const db = createClient({ url, authToken });

(async () => {
  const r = await db.execute(
    `SELECT id, email, nombre,
            mpSubStatus, mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo,
            mpSubAmount, mpSubIniciadoEn, mpSubAutorizadoEn, mpTestUserEmail
     FROM AkuoUsuario
     WHERE mpSubStatus IS NOT NULL OR mpSubPreapprovalId IS NOT NULL
     ORDER BY mpSubIniciadoEn DESC NULLS LAST LIMIT 10`
  );
  console.log(`\n=== ${r.rows.length} usuario(s) con sub MP ===`);
  for (const u of r.rows) {
    console.log(`\n• id=${u.id}  email=${u.email}`);
    console.log(`  mpSubStatus=${u.mpSubStatus}  preapprovalId=${u.mpSubPreapprovalId}`);
    console.log(`  plan=${u.mpSubPlanSolicitado}  ciclo=${u.mpSubCiclo}  amount=${u.mpSubAmount}`);
    console.log(`  iniciadoEn=${u.mpSubIniciadoEn}  autorizadoEn=${u.mpSubAutorizadoEn}`);
    console.log(`  mpTestUserEmail=${u.mpTestUserEmail ?? "(NO seteado — cae a email real)"}`);
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
