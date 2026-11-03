const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
(async () => {
  const before = await c.execute({sql: "SELECT radioKm FROM AkuoZona WHERE id = 'zona_sub_4102_1793573974976'"});
  console.log('Antes:', JSON.stringify(before.rows[0]));
  await c.execute({sql: "UPDATE AkuoZona SET radioKm = 2, actualizadoEn = ? WHERE id = 'zona_sub_4102_1793573974976'", args: [new Date().toISOString()]});
  const after = await c.execute({sql: "SELECT radioKm FROM AkuoZona WHERE id = 'zona_sub_4102_1793573974976'"});
  console.log('Después:', JSON.stringify(after.rows[0]));
})().catch(e => console.error('ERROR:', e.message));
