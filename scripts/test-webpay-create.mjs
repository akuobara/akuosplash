// Test directo de la API de Webpay Plus con las creds de DB.
// Lee transbankCommerceCode/transbankApiKey/transbankEnvironment de AkuoConfig
// y hace POST /rswebpaytransaction/api/webpay/v1.2/transactions con una tx de prueba.
import fs from "node:fs";
import { createClient } from "@libsql/client";

const SRC = fs.readFileSync("scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

const r = await db.execute({
  sql: "SELECT transbankCommerceCode, transbankApiKey, transbankEnvironment FROM AkuoConfig LIMIT 1",
});
const row = r.rows[0];
if (!row || !row.transbankCommerceCode || !row.transbankApiKey) {
  console.log("❌ No hay creds de Webpay Plus en DB");
  process.exit(1);
}
const code = String(row.transbankCommerceCode);
const env = String(row.transbankEnvironment || "INTEGRACION");
const base = env === "PRODUCCION" ? "https://webpay3g.transbank.cl" : "https://webpay3gint.transbank.cl";

// Probar ambas: la key de DB (64 chars) y la key estándar de integración (40 chars)
const STANDARDED = "579B5AE9D23CDBE18CB65FCC9E8B415DE3D23C49";
const keys = [
  { label: "DB key (64c)", value: String(row.transbankApiKey) },
  { label: "estándar (40c)", value: STANDARDED },
];

for (const { label, value: key } of keys) {
  console.log("\n=== Probando", label, "| prefix:", key.slice(0, 12) + "…", "===");
  const body = {
    buy_order: "TEST-WP-" + Date.now().toString().slice(-10),
    session_id: "test-session",
    amount: 50,
    return_url: "https://akuosplash.cl/api/akuosplash/subscription/transbank/return",
  };
  try {
    const res = await fetch(`${base}/rswebpaytransaction/api/webpay/v1.2/transactions`, {
      method: "POST",
      headers: { "Tbk-Api-Key-Id": code, "Tbk-Api-Key-Secret": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const rawText = await res.text();
    const data = rawText ? JSON.parse(rawText) : { _empty: true };
    console.log("HTTP:", res.status);
    console.log("  server:", res.headers.get("server"), "| cf-ray:", res.headers.get("cf-ray"), "| content-type:", res.headers.get("content-type"));
    console.log("  body:", rawText.slice(0, 400));
    if (res.ok && data.token && data.url) console.log("✅ ESTA KEY SIRVE — token:", String(data.token).slice(0, 16) + "…");
  } catch (e) {
    console.log("ERR:", e.message);
  }
}
