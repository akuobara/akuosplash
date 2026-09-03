// Daemon de sincronización automática con GitHub.
// Corre en background y cada N minutos hace commit+push.
// Uso:
//   node sync-daemon.js [intervalo-minutos]
//   default: 30 minutos
//
// Para detener: kill <pid> (pid se guarda en sync-daemon.pid)

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = "/home/z/my-project";
const SYNC_SCRIPT = path.join(__dirname, "sync-now.sh");
const PID_FILE = path.join(__dirname, "sync-daemon.pid");
const LOG_FILE = path.join(__dirname, "daemon.log");

const INTERVAL_MIN = parseInt(process.argv[2] || "30", 10);
const INTERVAL_MS = INTERVAL_MIN * 60 * 1000;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

// Guardar PID
fs.writeFileSync(PID_FILE, String(process.pid));
log(`Daemon iniciado. PID=${process.pid}. Intervalo=${INTERVAL_MIN} min.`);

// Manejar señales para limpiar
process.on("SIGTERM", () => {
  log("SIGTERM recibido, saliendo.");
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});
process.on("SIGINT", () => {
  log("SIGINT recibido, saliendo.");
  try { fs.unlinkSync(PID_FILE); } catch {}
  process.exit(0);
});

async function runSync() {
  log("Ejecutando sync-now.sh...");
  const result = spawnSync("bash", [SYNC_SCRIPT], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    timeout: 5 * 60 * 1000,
  });
  if (result.status === 0) {
    log("Sync OK.");
  } else {
    log(`Sync falló (exit ${result.status}). stdout: ${result.stdout || ""} stderr: ${result.stderr || ""}`);
  }
}

// Primera corrida inmediata (solo si hay cambios pendientes)
runSync().then(() => {
  // Loop
  setInterval(runSync, INTERVAL_MS);
  log(`Próxima sync en ${INTERVAL_MIN} minutos.`);
});

// Mantener vivo
setInterval(() => {}, 1 << 30);
