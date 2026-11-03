const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
const SUB_ID = 'zona_sub_4102_1793573974976';
(async () => {
  // Calcular centro real: promedio de los 3 clientes en Cruz de Caña
  const realLat = -30.014109;  // (-30.0137831 + -30.0126232 + -30.01592) / 3
  const realLng = -71.202685;  // (-71.20299 + -71.2075964 + -71.197482) / 3
  
  // Antes
  const before = await c.execute({sql: 'SELECT centroLat, centroLng FROM AkuoZona WHERE id = ?', args: [SUB_ID]});
  console.log('Antes:', JSON.stringify(before.rows[0]));
  
  // Update
  await c.execute({
    sql: 'UPDATE AkuoZona SET centroLat = ?, centroLng = ?, actualizadoEn = ? WHERE id = ?',
    args: [realLat, realLng, new Date().toISOString(), SUB_ID]
  });
  
  // Después
  const after = await c.execute({sql: 'SELECT centroLat, centroLng FROM AkuoZona WHERE id = ?', args: [SUB_ID]});
  console.log('Después:', JSON.stringify(after.rows[0]));
  console.log('');
  console.log('Distancia corregida: el círculo ahora está en Cruz de Caña real (-30.014, -71.203)');
})().catch(e => console.error('ERROR:', e.message));
