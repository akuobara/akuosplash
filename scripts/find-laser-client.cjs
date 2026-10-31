const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  // First, get the schema
  const cols = await c.execute("PRAGMA table_info(Cliente)");
  console.log('=== Cliente columns ===');
  for (const col of cols.rows) console.log(col.name, col.type);
  
  // Search for client
  const r = await c.execute("SELECT id, nombre, direccion, zona, telefono, lat, lng FROM Cliente WHERE LOWER(nombre) LIKE '%laser%' OR LOWER(nombre) LIKE '%lazer%' COLLATE NOCASE");
  console.log('\n=== CLIENTES "LASER" ===');
  if (r.rows.length === 0) console.log('No se encontró ningún cliente con "laser" en el nombre');
  for (const row of r.rows) console.log(JSON.stringify(row, null, 2));
  
  // If no match, list all clients with similar-sounding names
  if (r.rows.length === 0) {
    const r2 = await c.execute("SELECT id, nombre, direccion, zona FROM Cliente WHERE LOWER(nombre) LIKE '%l%s%' OR LOWER(nombre) LIKE '%las%' OR LOWER(nombre) LIKE '%ser%' COLLATE NOCASE LIMIT 20");
    console.log('\n=== Clientes con "l-s" o "las" o "ser" ===');
    for (const row of r2.rows) console.log(JSON.stringify(row));
  }
})();
