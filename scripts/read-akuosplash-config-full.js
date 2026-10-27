// Inspeccionar TODA la fila AkuoConfig activa para encontrar campos de fee/manual
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});
(async () => {
  const r = await db.execute("SELECT * FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  if (r.rows.length === 0) { console.log("Sin fila activa"); return; }
  const row = r.rows[0];
  for (const k of Object.keys(row)) {
    if (row[k] === null || row[k] === undefined || row[k] === "") continue;
    const v = String(row[k]).substring(0, 300);
    console.log(`${k}: ${v}`);
  }
})();
