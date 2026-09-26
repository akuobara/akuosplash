// Diagnóstico completo: trace de Entregas y Pedidos de "Mama asistente"
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const clienteId = 'cmthi6esh0001l304uux76aqo'; // "Mama asistente"
  const recurrenteId = 'cmtitg2xc000...'; // prefix, need full id

  // 1) Recuperar el recurrente con su id completo
  const rec = await client.execute({
    sql: `SELECT id, frecuenciaDias, fechaInicio, fechaProximaGeneracion, activo
          FROM PedidoRecurrente WHERE clienteId = ?`,
    args: [clienteId],
  });
  console.log('=== Recurrente ===');
  for (const r of rec.rows) console.log(r);

  const recurrenteFullId = rec.rows[0].id;

  // 2) Todas las Entregas al cliente (fecha real)
  console.log('\n=== Entregas al cliente "Mama asistente" ===');
  const entregas = await client.execute({
    sql: `SELECT id, fecha, litros, total, vueltaId, choferId
          FROM Entrega WHERE clienteId = ?
          ORDER BY fecha ASC`,
    args: [clienteId],
  });
  for (const e of entregas.rows) {
    console.log(`  ${e.fecha} | litros=${e.litros} | total=${e.total} | vueltaId=${e.vueltaId ? e.vueltaId.slice(0,8) : 'null'} | choferId=${e.choferId ? e.choferId.slice(0,8) : 'null'}`);
  }

  // 3) Todos los pedidos del cliente con todos los campos relevantes
  console.log('\n=== Todos los pedidos del cliente "Mama asistente" ===');
  const pedidos = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado, pedidoRecurrenteId, entregaId, choferId, choferAsignadoId, nota
          FROM Pedido WHERE clienteId = ?
          ORDER BY creadoEn ASC`,
    args: [clienteId],
  });
  for (const p of pedidos.rows) {
    console.log(`  creado=${p.creadoEn} | solicitado=${p.fechaSolicitada} | estado=${p.estado} | recId=${p.pedidoRecurrenteId ? p.pedidoRecurrenteId.slice(0,8) : 'null'} | entregaId=${p.entregaId ? p.entregaId.slice(0,8) : 'null'} | choferId=${p.choferId ? p.choferId.slice(0,8) : 'null'} | asignadoId=${p.choferAsignadoId || 'null'}`);
  }

  // 4) Trazabilidad: calcular qué fechas esperamos según entregas + frecuencia
  console.log('\n=== Análisis de fechas esperadas (cada 10 días) ===');
  const ultEntrega = entregas.rows[entregas.rows.length - 1];
  if (ultEntrega) {
    const ultimaFecha = new Date(ultEntrega.fecha);
    console.log(`Última entrega real: ${ultimaFecha.toISOString()}`);
    for (let i = 1; i <= 5; i++) {
      const prox = new Date(ultimaFecha);
      prox.setDate(prox.getDate() + 10 * i);
      console.log(`  +${10*i} días = ${prox.toISOString()}`);
    }
  }

  // 5) Pedidos programados futuros del cliente
  console.log('\n=== Pedidos futuros programados (estado=programado o pendiente) ===');
  const futuros = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado, choferId
          FROM Pedido
          WHERE clienteId = ? AND estado IN ('programado', 'pendiente')
          ORDER BY fechaSolicitada ASC`,
    args: [clienteId],
  });
  for (const p of futuros.rows) {
    console.log(`  ${p.fechaSolicitada} | creado=${p.creadoEn} | estado=${p.estado} | choferId=${p.choferId ? p.choferId.slice(0,8) : 'null'}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
