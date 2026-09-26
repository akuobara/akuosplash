// Investigar el caso "Diana Ibañez fue reagendada sin pedir confirmación"
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const CLIENTE_ID = 'cmtyp779u0001l204c7qdd94d'; // Diana Ibañez (ex Arrayanes j3)

  console.log('=== Estado del cliente ===');
  const cli = await client.execute({ sql: `SELECT id, nombre FROM Cliente WHERE id = ?`, args: [CLIENTE_ID] });
  console.log(cli.rows[0]);

  console.log('\n=== Todos los pedidos del cliente (recientes y viejos) ===');
  const pedidos = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado, clienteNombre, nota, pedidoRecurrenteId, choferId, entregaId
          FROM Pedido WHERE clienteId = ?
          ORDER BY creadoEn ASC`,
    args: [CLIENTE_ID],
  });
  for (const p of pedidos.rows) {
    console.log(`  creado=${p.creadoEn} | solicitado=${p.fechaSolicitada} | estado=${p.estado} | nombre="${p.clienteNombre}" | recId=${p.pedidoRecurrenteId ? p.pedidoRecurrenteId.slice(0,8) : 'null'} | choferId=${p.choferId ? p.choferId.slice(0,8) : 'null'} | nota="${p.nota || ''}"`);
  }

  console.log('\n=== PedidoRecurrente del cliente (si existe) ===');
  const recs = await client.execute({
    sql: `SELECT id, creadoEn, frecuenciaDias, fechaInicio, fechaProximaGeneracion, activo, asignacionTipo, choferAsignadoId
          FROM PedidoRecurrente WHERE clienteId = ?`,
    args: [CLIENTE_ID],
  });
  for (const r of recs.rows) console.log(r);

  console.log('\n=== Entregas del cliente ===');
  const ents = await client.execute({
    sql: `SELECT id, fecha, clienteNombre, total, montoRecibido, vueltaId, choferId
          FROM Entrega WHERE clienteId = ?
          ORDER BY fecha DESC`,
    args: [CLIENTE_ID],
  });
  for (const e of ents.rows) console.log(`  ${e.fecha} | nombre="${e.clienteNombre}" | total=${e.total} | monto=${e.montoRecibido} | choferId=${e.choferId ? e.choferId.slice(0,8) : 'null'}`);

  // Buscar pedidos creados HOY (26-sep CL) — el que se "reagendó sin permiso"
  console.log('\n=== Pedidos creados hoy (26-sep CL = 04:00 UTC 26 → 04:00 UTC 27) ===');
  const hoy = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado, clienteId, clienteNombre, pedidoRecurrenteId, choferId
          FROM Pedido
          WHERE creadoEn >= '2026-09-26T04:00:00Z' AND creadoEn < '2026-09-27T04:00:00Z'
          ORDER BY creadoEn ASC`,
  });
  console.log(`Pedidos creados hoy: ${hoy.rows.length}`);
  for (const p of hoy.rows) {
    console.log(`  creado=${p.creadoEn} | solicitado=${p.fechaSolicitada} | cliente="${p.clienteNombre}" (id=${p.clienteId ? p.clienteId.slice(0,8) : 'null'}) | estado=${p.estado} | recId=${p.pedidoRecurrenteId ? p.pedidoRecurrenteId.slice(0,8) : 'null'}`);
  }

  // Buscar si corrió el cron recientemente
  console.log('\n=== Estado de recurrentes activos (cualquiera con fechaProximaGeneracion <= ahora) ===');
  const vencidos = await client.execute({
    sql: `SELECT id, clienteId, frecuenciaDias, fechaInicio, fechaProximaGeneracion, activo
          FROM PedidoRecurrente
          WHERE activo = 1 AND fechaProximaGeneracion <= datetime('now')
          ORDER BY fechaProximaGeneracion ASC`,
  });
  console.log(`Recurrentes activos vencidos: ${vencidos.rows.length}`);
  for (const r of vencidos.rows) console.log(r);
}
main().catch(e => { console.error(e); process.exit(1); });
