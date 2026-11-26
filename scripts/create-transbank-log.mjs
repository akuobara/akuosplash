// Crea la tabla TransbankTxLog en la DB Turso para registrar todas las
// transacciones de prueba de la certificación Transbank (sin pisar datos).
import fs from "node:fs";
import { createClient } from "@libsql/client";

const SRC = fs.readFileSync("scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

const ddl = `
CREATE TABLE IF NOT EXISTS TransbankTxLog (
  id TEXT PRIMARY KEY,
  userId TEXT,
  buyOrder TEXT UNIQUE NOT NULL,
  tokenWs TEXT,
  amount INTEGER,
  plan TEXT,
  ciclo TEXT,
  status TEXT,
  responseCode TEXT,
  authorizationCode TEXT,
  vci TEXT,
  cardType TEXT,
  cardLast4 TEXT,
  paymentTypeCode TEXT,
  installmentsNumber INTEGER,
  transactionDate TEXT,
  refundType TEXT,
  refundResponseCode TEXT,
  refundDate TEXT,
  prueba TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_transbanktxlog_tokenWs ON TransbankTxLog(tokenWs);
CREATE INDEX IF NOT EXISTS idx_transbanktxlog_userId ON TransbankTxLog(userId);
`;

try {
  await db.executeMultiple(ddl);
  console.log("✅ Tabla TransbankTxLog creada (o ya existía)");
  // verificar
  const r = await db.execute({ sql: "SELECT COUNT(*) as c FROM TransbankTxLog" });
  console.log("   filas actuales:", r.rows[0].c);
} catch (e) {
  console.error("❌ ERR:", e.message);
  process.exit(1);
}
