// Fix typo "Eiqna Ibañez" → "Diana Ibañez" en cliente + pedidos + entregas
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const CLIENTE_ID = 'cmtyp779u0001l204c7qdd94d';
  const NOMBRE_CORRECTO = 'Diana Ibañez';

  // 1) Verificar estado actual
  console.log('=== Estado ANTES ===');
  const before = await client.execute({
    sql: `SELECT id, nombre FROM Cliente WHERE id = ?`,
    args: [CLIENTE_ID],
  });
  console.log('Cliente:', before.rows[0]);

  const pedidosBefore = await client.execute({
    sql: `SELECT id, clienteNombre, estado FROM Pedido WHERE clienteId = ?`,
    args: [CLIENTE_ID],
  });
  console.log(`Pedidos con este cliente: ${pedidosBefore.rows.length}`);
  for (const p of pedidosBefore.rows) console.log(`  ${p.id.slice(0,12)} | nombre="${p.clienteNombre}" | estado=${p.estado}`);

  const entregasBefore = await client.execute({
    sql: `SELECT id, clienteNombre, fecha FROM Entrega WHERE clienteId = ?`,
    args: [CLIENTE_ID],
  });
  console.log(`Entregas con este cliente: ${entregasBefore.rows.length}`);
  for (const e of entregasBefore.rows) console.log(`  ${e.id.slice(0,12)} | nombre="${e.clienteNombre}" | fecha=${e.fecha}`);

  // 2) Actualizar nombre del cliente
  console.log('\n=== Arreglando typo en Cliente ===');
  const upd1 = await client.execute({
    sql: `UPDATE Cliente SET nombre = ? WHERE id = ?`,
    args: [NOMBRE_CORRECTO, CLIENTE_ID],
  });
  console.log(`Cliente actualizado (${upd1?.meta?.changes ?? 'ok'} rows)`);

  // 3) Actualizar clienteNombre en todos los pedidos (snapshot)
  console.log('\n=== Actualizando clienteNombre en Pedidos ===');
  const upd2 = await client.execute({
    sql: `UPDATE Pedido SET clienteNombre = ? WHERE clienteId = ?`,
    args: [NOMBRE_CORRECTO, CLIENTE_ID],
  });
  console.log(`Pedidos actualizados (${upd2?.meta?.changes ?? 'ok'} rows)`);

  // 4) Actualizar clienteNombre en todas las entregas (snapshot)
  console.log('\n=== Actualizando clienteNombre en Entregas ===');
  const upd3 = await client.execute({
    sql: `UPDATE Entrega SET clienteNombre = ? WHERE clienteId = ?`,
    args: [NOMBRE_CORRECTO, CLIENTE_ID],
  });
  console.log(`Entregas actualizadas (${upd3?.meta?.changes ?? 'ok'} rows)`);

  // 5) Actualizar pagos sueltos (si tienen clienteNombre snapshot)
  try {
    const upd4 = await client.execute({
      sql: `UPDATE Pago SET clienteNombre = ? WHERE clienteId = ?`,
      args: [NOMBRE_CORRECTO, CLIENTE_ID],
    });
    console.log(`Pagos actualizados (${upd4?.meta?.changes ?? 'ok'} rows)`);
  } catch (e) {
    console.log('Pago no tiene clienteNombre, salteando.');
  }

  // 6) Verificar
  console.log('\n=== Estado DESPUÉS ===');
  const after = await client.execute({ sql: `SELECT nombre FROM Cliente WHERE id = ?`, args: [CLIENTE_ID] });
  console.log('Cliente:', after.rows[0]);

  const pedidosAfter = await client.execute({ sql: `SELECT clienteNombre FROM Pedido WHERE clienteId = ?`, args: [CLIENTE_ID] });
  for (const p of pedidosAfter.rows) console.log(`Pedido: "${p.clienteNombre}"`);

  const entregasAfter = await client.execute({ sql: `SELECT clienteNombre FROM Entrega WHERE clienteId = ?`, args: [CLIENTE_ID] });
  for (const e of entregasAfter.rows) console.log(`Entrega: "${e.clienteNombre}"`);

  console.log('\n✓ Hecho. El cliente ahora se llama "Diana Ibañez" y los pedidos/entregas también.');
}
main().catch(e => { console.error(e); process.exit(1); });
