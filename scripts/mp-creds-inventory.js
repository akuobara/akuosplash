const fs = require("fs");
const src = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = src.match(re); return m ? m[1] : null; };
const dbUrl = grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/);
const dbAuth = grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/);
const { createClient } = require("@libsql/client");
const db = createClient({ url: dbUrl, authToken: dbAuth });

// Clasificar tokens sin imprimirlos completos
const classify = (v) => {
  if (!v) return "(vacío)";
  const s = String(v);
  if (s.startsWith("TEST-")) return `TEST- (${s.length} chars) ¡CREDENCIAL DE PRUEBA!`;
  if (s.startsWith("APP_USR-")) return `APP_USR- (${s.length} chars) — prefijo app: ${s.split("-")[1]}`;
  return `${s.slice(0, 6)}... (${s.length} chars)`;
};

(async () => {
  // 1) TODOS los campos mp* de AkuoConfig
  const cols = await db.execute(`PRAGMA table_info(AkuoConfig)`);
  const mpCols = cols.rows.map(r => String(r.name)).filter(n => /^mp/i.test(n) || /[Mm]p[A-Z]/.test(n));
  console.log("=== AkuoConfig: campos mp* ===");
  const sel = await db.execute(`SELECT ${mpCols.join(", ")} FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
  for (const [k, v] of Object.entries(sel.rows[0] || {})) {
    if (/token/i.test(k)) console.log(`  ${k}: ${classify(v)}`);
    else console.log(`  ${k}: ${v === null ? "(null)" : String(v).slice(0, 40)}`);
  }

  // 2) Env vars de Render (solo las MP)
  console.log("\n=== Env vars MP en create-render-service.py ===");
  const envMatches = [...src.matchAll(/"key":\s*"(AKUO_MP[^"]*|MP_[^"]*)"[^}]*?"value":\s*"([^"]*)"/g)];
  for (const m of envMatches) {
    console.log(`  ${m[1]}: ${classify(m[2])}`);
  }

  // 3) ¿Alguna credencial TEST- en el repo? (buscar sin imprimirlas)
  console.log("\n=== Búsqueda de tokens TEST- en scripts/ y repo ===");
  const { execSync } = require("child_process");
  try {
    const out = execSync(`grep -rl "TEST-[0-9]" /home/z/my-project/scripts/ /home/z/my-project/src/ 2>/dev/null | head -10`, { encoding: "utf8" });
    console.log(out.trim() || "(ningún archivo contiene tokens TEST-)");
  } catch (e) {
    console.log("(ningún archivo contiene tokens TEST-)");
  }
})().catch(e => console.error("ERROR:", e.message));
