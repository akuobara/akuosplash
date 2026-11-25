// Verifica si el override de username está deployado (bddd47c) Y testea la hipótesis
// del username duplicado: crea una inscripción con un username RANDOM.
// - Si la DB guarda el username random → bddd47c está live (override funciona).
// - Si la DB guarda el username estable → todavía deployed f9864eb (override ausente).
// En cualquier caso, deja una inscripción lista; si el override funcionó, el token
// usa username random → el usuario lo prueba para descartar/confirmar el 292.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const BASE = "https://akuosplash.cl";
const EMAIL = "transtest3@akuosplash.test";
const PASS = "Test1234!";
const RAND_USER = "diag" + Date.now().toString().slice(-10);

(async () => {
  // 1. Reset
  await db.execute({
    sql: `UPDATE AkuoUsuario SET plan='gratis', tbkUsername=NULL, tbkUser=NULL, tbkCardType=NULL, tbkCardLast4=NULL, tbkInscriptionStatus=NULL, tbkInscriptionToken=NULL, tbkInscriptionEmail=NULL, tbkSubscriptionActive=0 WHERE email=?`,
    args: [EMAIL],
  });
  console.log("✓ reset transtest3 | username override a probar:", RAND_USER);

  // 2. Login
  const lr = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const sc = lr.headers.get("set-cookie") || "";
  const m = sc.match(/akuosplash_session=([^;]+)/);
  if (!m) { console.log("✗ login falló:", lr.status); return; }
  const sess = m[1];

  // 3. Start con username override
  const r = await fetch(`${BASE}/api/akuosplash/subscription/transbank/oneclick/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `akuosplash_session=${sess}` },
    body: JSON.stringify({ username: RAND_USER }),
  });
  const b = await r.json().catch(() => ({}));
  console.log("  HTTP:", r.status, "| token:", (b.token || "").slice(0, 16) + "...", "| url:", (b.url || "").slice(0, 50));

  // 4. Leer DB para ver qué username guardó
  const s = await db.execute({
    sql: "SELECT tbkUsername, tbkInscriptionStatus, tbkInscriptionToken FROM AkuoUsuario WHERE email=?",
    args: [EMAIL],
  });
  const x = s.rows[0] || {};
  console.log("\n  DB tbkUsername:", x.tbkUsername);
  console.log("  DB status:", x.tbkInscriptionStatus);

  if (x.tbkUsername === RAND_USER) {
    console.log("\n✓ OVERRIDE FUNCIONA → bddd47c está live. Username random aplicado.");
    console.log("  → El token de esta inscripción usa username RANDOM. Probalo para aislar el 292.");
  } else {
    console.log("\n✗ OVERRIDE NO FUNCIONA → deployed sigue siendo f9864eb (sin override).");
    console.log("  → Hay que deployar bddd47c con commitId explícito.");
  }
})().catch(e => console.error("ERR", e.message));
