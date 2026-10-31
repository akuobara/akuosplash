const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
const REC_ID = 'cmtitefgg0001jq048jsv61oy';

(async () => {
  // 1. Estado actual
  const before = await c.execute({ sql: 'SELECT id, nombre FROM Cliente WHERE id = (SELECT clienteId FROM PedidoRecurrente WHERE id = ?)', args: [REC_ID] });
  console.log('Cliente:', JSON.stringify(before.rows[0]));
  
  const rec = await c.execute({ sql: 'SELECT fechaProximaGeneracion, frecuenciaDias, diaSemanaPreferido, activo FROM PedidoRecurrente WHERE id = ?', args: [REC_ID] });
  console.log('Antes:', JSON.stringify(rec.rows[0]));
  
  // 2. Resetear fechaProximaGeneracion a hoy (2026-11-01) para que el cron lo procese
  // diaSemanaPreferido = 3 (miércoles). Hoy es sábado Nov 1.
  // El próximo miércoles es Nov 4. Seteamos fechaProximaGeneracion = Nov 1 (hoy) para que el cron
  // lo procese y cree un pedido con fechaSolicitada = Nov 4 (próximo miércoles).
  // Pero el cron usa fechaProximaGeneracion como fechaSolicitada del pedido.
  // Así que seteamos fechaProximaGeneracion = Nov 4 (próximo miércoles) para que el pedido
  // quede programado para Nov 4, Y que sea <= hoy... pero Nov 4 > Nov 1.
  // Mejor: seteamos fechaProximaGeneracion = Oct 28 (miércoles pasado) para que el cron:
  //   1. Lo procese (Oct 28 <= Nov 1)
  //   2. Cree pedido con fechaSolicitada = Oct 28 (el miércoles que faltó)
  //   3. Avance fechaProximaGeneracion a Nov 4 (próximo miércoles)
  await c.execute({ sql: "UPDATE PedidoRecurrente SET fechaProximaGeneracion = '2026-10-28T00:00:00Z' WHERE id = ?", args: [REC_ID] });
  
  const after = await c.execute({ sql: 'SELECT fechaProximaGeneracion FROM PedidoRecurrente WHERE id = ?', args: [REC_ID] });
  console.log('Después:', JSON.stringify(after.rows[0]));
})().catch(e => console.error('ERROR:', e.message));
