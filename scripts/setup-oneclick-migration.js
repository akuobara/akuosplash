// Migración Oneclick: agrega columnas nuevas a AkuoUsuario + AkuoConfig, y setea
// las credenciales de integración (mall + child code) en AkuoConfig.
// Idempotente: se puede correr varias veces.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  // Credenciales Oneclick Mall integración (oficial SDK Transbank)
  const MALL_CODE = "597055555541";
  const CHILD_CODE = "597055555542";
  const API_KEY = "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";

  // Columnas nuevas (ALTER TABLE idempotente)
  const cols = [
    ["AkuoConfig", "transbankOneclickMallCode", "TEXT"],
    ["AkuoConfig", "transbankOneclickChildCode", "TEXT"],
    ["AkuoUsuario", "tbkUsername", "TEXT"],
    ["AkuoUsuario", "tbkUser", "TEXT"],
    ["AkuoUsuario", "tbkCardType", "TEXT"],
    ["AkuoUsuario", "tbkCardLast4", "TEXT"],
    ["AkuoUsuario", "tbkInscriptionStatus", "TEXT"],
    ["AkuoUsuario", "tbkInscriptionToken", "TEXT"],
    ["AkuoUsuario", "tbkInscriptionEmail", "TEXT"],
    ["AkuoUsuario", "tbkSubscriptionActive", "BOOLEAN NOT NULL DEFAULT 0"],
    ["AkuoUsuario", "tbkLastCobroBuyOrder", "TEXT"],
    ["AkuoUsuario", "tbkLastCobroEn", "DateTime"],
    ["AkuoUsuario", "tbkLastCobroAuthCode", "TEXT"],
  ];

  for (const [tabla, columna, definicion] of cols) {
    try {
      await db.execute(`ALTER TABLE "${tabla}" ADD COLUMN "${columna}" ${definicion};`);
      console.log(`✓ ${tabla}.${columna} agregada`);
    } catch (e) {
      const msg = e.message || String(e);
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        console.log(`- ${tabla}.${columna} ya existía`);
      } else {
        console.error(`✗ ${tabla}.${columna}: ${msg}`);
      }
    }
  }

  // Setear credenciales Oneclick en AkuoConfig
  await db.execute({
    sql: `UPDATE AkuoConfig SET transbankOneclickMallCode=?, transbankOneclickChildCode=?, transbankApiKey=?, transbankEnvironment='INTEGRACION' WHERE activo=1`,
    args: [MALL_CODE, CHILD_CODE, API_KEY],
  });
  console.log("\n✓ Credenciales Oneclick Mall guardadas en AkuoConfig:");
  console.log(`  mallCode:   ${MALL_CODE}`);
  console.log(`  childCode:  ${CHILD_CODE}`);
  console.log(`  apiKey:     ${API_KEY.slice(0, 16)}...`);
  console.log(`  environment: INTEGRACION`);

  // Verificar transtest3 estado oneclick
  const u = (await db.execute(
    "SELECT tbkUsername, tbkUser, tbkCardLast4, tbkInscriptionStatus, tbkSubscriptionActive FROM AkuoUsuario WHERE email=?",
    ["transtest3@akuosplash.test"]
  )).rows[0];
  console.log("\ntranstest3 oneclick:", JSON.stringify(u));
})().catch(e => console.error("ERR", e.message));
