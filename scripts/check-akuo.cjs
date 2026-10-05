const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
async function main() {
  const r = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Akuo%' ORDER BY name");
  console.log(`Tablas Akuo* en Turso: ${r.rows.length}`);
  for (const t of r.rows) console.log(`  ${t.name}`);
  
  // Verificar usuarios
  const users = await client.execute("SELECT COUNT(*) AS c FROM AkuoUsuario");
  console.log(`\nUsuarios Akuo: ${users.rows[0].c}`);
}
main().catch(e => { console.error(e); process.exit(1); });
