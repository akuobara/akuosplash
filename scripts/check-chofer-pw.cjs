const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  const r = await c.execute("SELECT id, email, nombre, role, passwordHash, telefono, activo FROM Usuario WHERE email = 'jeremymichelraymond@gmail.com' OR telefono LIKE '%97819709%'");
  for (const u of r.rows) {
    console.log({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      role: u.role,
      telefono: u.telefono,
      activo: u.activo,
      passwordHash_prefix: String(u.passwordHash).substring(0, 30),
      passwordHash_length: String(u.passwordHash).length,
      has_colon: String(u.passwordHash).includes(':'),
    });
  }
})();
