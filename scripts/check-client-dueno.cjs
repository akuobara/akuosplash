const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  const r = await c.execute("SELECT duenoId, COUNT(*) as n FROM Cliente GROUP BY duenoId");
  console.log("Clientes por duenoId:");
  for (const row of r.rows) console.log(JSON.stringify(row));
  const u = await c.execute("SELECT id, email, nombre, role, duenoId FROM Usuario WHERE id IN (SELECT duenoId FROM Cliente GROUP BY duenoId) OR duenoId IN (SELECT duenoId FROM Cliente GROUP BY duenoId)");
  console.log("Usuarios con clientes:");
  for (const row of u.rows) console.log(JSON.stringify(row));
})();
