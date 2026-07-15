const { createClient } = require('@libsql/client');
const client = createClient({ 
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const result = await client.execute({
    sql: "SELECT id, email, nombre, role FROM Usuario WHERE email = ?",
    args: ['akuobara@gmail.com'],
  });
  
  console.log('Usuarios con email akuobara@gmail.com:', result.rows.length);
  for (const row of result.rows) {
    console.log(`  ID: ${row.id}, Nombre: ${row.nombre}, Role: ${row.role}`);
  }
}
main().catch(e => console.error(e));
