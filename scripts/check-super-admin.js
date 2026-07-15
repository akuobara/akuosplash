const { createClient } = require('@libsql/client');
const client = createClient({ 
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const result = await client.execute({
    sql: "SELECT id, email, nombre, role, activo, passwordHash FROM Usuario WHERE email = ?",
    args: ['akuobara@gmail.com'],
  });
  
  if (result.rows.length === 0) {
    console.log('No se encontró el usuario');
    return;
  }
  
  for (const row of result.rows) {
    console.log('ID:', row.id);
    console.log('Email:', row.email);
    console.log('Nombre:', row.nombre);
    console.log('Role:', row.role);
    console.log('Activo:', row.activo);
    console.log('PasswordHash:', row.passwordHash?.substring(0, 30) + '...');
  }
}
main().catch(e => console.error(e));
