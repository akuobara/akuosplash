const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  try {
    const r = await c.execute("SELECT COUNT(*) as total FROM Cliente");
    console.log("TOTAL Cliente:", r.rows[0].total);
    const r2 = await c.execute("SELECT COUNT(*) as conGps FROM Cliente WHERE lat IS NOT NULL AND lng IS NOT NULL");
    console.log("Con GPS:", r2.rows[0].conGps);
    const r3 = await c.execute("SELECT id, nombre, lat, lng FROM Cliente WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 5");
    console.log("Muestra:", JSON.stringify(r3.rows, null, 2));
  } catch (e) {
    console.error("ERROR:", e.message);
  }
})();
