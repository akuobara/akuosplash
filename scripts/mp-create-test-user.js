const { createClient } = require("@libsql/client");
const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const url = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const authToken = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const db = createClient({ url, authToken });

(async () => {
  const cfg = await db.execute(`SELECT mpSubAccessToken FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  const TOK = cfg.rows[0].mpSubAccessToken;
  console.log(`token prefix: ${TOK.slice(0,12)}`);

  // Listar test users existentes (GET /users/test_user)
  const lr = await fetch(`https://api.mercadopago.com/users/test_user`, {
    headers: { Authorization: `Bearer ${TOK}` },
  });
  const ld = await lr.json().catch(() => ({}));
  console.log(`\n=== test users existentes: HTTP ${lr.status} ===`);
  console.log(JSON.stringify(ld).slice(0, 600));

  // Crear NUEVO test user comprador (site_id MLC = Chile)
  const cr = await fetch(`https://api.mercadopago.com/users/test_user`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOK}`, "Content-Type": "application/json" },
    body: JSON.stringify({ site_id: "MLC" }),
  });
  const cd = await cr.json().catch(() => ({}));
  console.log(`\n=== CREAR test user: HTTP ${cr.status} ===`);
  if (cr.ok) {
    console.log(`id: ${cd.id}`);
    console.log(`email: ${cd.email}`);
    console.log(`password: ${cd.password}`);
    console.log(`nickname: ${cd.nickname}`);
    // guardar en archivo (no en DB todavía)
    fs.writeFileSync("/home/z/my-project/scripts/mp-test-user.json", JSON.stringify({ id: cd.id, email: cd.email, password: cd.password, nickname: cd.nickname, creado: new Date().toISOString() }, null, 2));
    console.log("(guardado en scripts/mp-test-user.json)");
  } else {
    console.log(`error: ${JSON.stringify(cd).slice(0, 400)}`);
  }
})().catch(e => console.error("ERROR:", e.message));
