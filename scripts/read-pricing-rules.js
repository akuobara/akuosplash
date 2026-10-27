// Leer campos relevantes completos
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});
(async () => {
  const r = await db.execute("SELECT reglasPrecioJson, retiroFeeFijoGlobal, retiroFeePctGlobal, mpSandbox FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const row = r.rows[0];
  console.log("=== retiroFeeFijoGlobal ===", row.retiroFeeFijoGlobal);
  console.log("=== retiroFeePctGlobal ===", row.retiroFeePctGlobal);
  console.log("=== mpSandbox ===", row.mpSandbox);
  console.log("\n=== reglasPrecioJson (completo) ===");
  const parsed = JSON.parse(row.reglasPrecioJson);
  console.log(JSON.stringify(parsed, null, 2));
})();
