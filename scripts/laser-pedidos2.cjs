const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
const CLIENTE_ID = 'cmthhy1sf0005jo04fayj9p5w';
(async () => {
  // Schema of Entrega
  const cols = await c.execute("PRAGMA table_info(Entrega)");
  console.log('=== Entrega columns ===');
  for (const col of cols.rows) console.log('  ' + col.name + ' ' + col.type);
  
  // Get entregas with correct column names
  const ent = await c.execute({
    sql: "SELECT * FROM Entrega WHERE clienteId = ? ORDER BY fecha DESC LIMIT 6",
    args: [CLIENTE_ID]
  });
  console.log('\n=== Entregas Laser (últimas 6) — count: ' + ent.rows.length + ' ===');
  for (const e of ent.rows) console.log(JSON.stringify(e));
})().catch(e => console.error('ERROR:', e.message));
