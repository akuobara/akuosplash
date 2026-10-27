// Lee la config de planos persistida en AkuoConfig (Turso producción)
const { createClient } = require("@libsql/client");

const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});

(async () => {
  try {
    const r = await db.execute("SELECT id, planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
    if (r.rows.length === 0) {
      console.log("No hay fila AkuoConfig activa — usando DEFAULT_PLAN_CONFIGS");
      return;
    }
    const row = r.rows[0];
    const json = row.planConfigsJson;
    if (!json) {
      console.log("planConfigsJson está vacío — usando defaults");
      return;
    }
    const parsed = JSON.parse(json);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.error("Error:", e.message);
  }
})();
