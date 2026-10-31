const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  await c.execute({
    sql: "UPDATE PedidoRecurrente SET fechaProximaGeneracion = '2026-11-04T00:00:00Z' WHERE id = ?",
    args: ['cmtitefgg0001jq048jsv61oy']
  });
  const r = await c.execute({
    sql: "SELECT fechaProximaGeneracion FROM PedidoRecurrente WHERE id = ?",
    args: ['cmtitefgg0001jq048jsv61oy']
  });
  console.log('fechaProximaGeneracion corregida:', JSON.stringify(r.rows[0]));
})().catch(e => console.error('ERROR:', e.message));
