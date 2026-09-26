// Investigar el caso "mamá asistente" — recurrente que debería ser cada 10 días
// pero aparecen pedidos para 30-sep y 1-oct (uno demás)
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Buscar el cliente "mamá asistente" o similar
  const clientes = await client.execute({
    sql: `SELECT id, nombre, duenoId, choferPreferidoId FROM Cliente WHERE LOWER(nombre) LIKE '%mam%' OR LOWER(nombre) LIKE '%asistente%' OR LOWER(nombre) LIKE '%mama%'`,
  });
  console.log(`=== Clientes encontrados: ${clientes.rows.length} ===`);
  for (const c of clientes.rows) {
    console.log(`  id=${c.id} | nombre="${c.nombre}" | duenoId=${c.duenoId} | choferPreferidoId=${c.choferPreferidoId || 'null'}`);
  }

  for (const c of clientes.rows) {
    console.log(`\n=== Pedidos de "${c.nombre}" (id=${c.id}) ===`);
    const pedidos = await client.execute({
      sql: `SELECT id, creadoEn, fechaSolicitada, estado, pedidoRecurrenteId, choferId, nota
            FROM Pedido WHERE clienteId = ?
            ORDER BY fechaSolicitada ASC`,
      args: [c.id],
    });
    for (const p of pedidos.rows) {
      console.log(`  id=${p.id.slice(0,12)} | creado=${p.creadoEn} | solicitado=${p.fechaSolicitada} | estado=${p.estado} | recId=${p.pedidoRecurrenteId ? p.pedidoRecurrenteId.slice(0,8) : 'null'} | choferId=${p.choferId ? p.choferId.slice(0,8) : 'null'} | nota=${p.nota || ''}`);
    }

    console.log(`\n=== PedidoRecurrente de "${c.nombre}" ===`);
    const recurrentes = await client.execute({
      sql: `SELECT id, creadoEn, litrosSolicitados, frecuenciaDias, fechaInicio, fechaProximaGeneracion, activo, asignacionTipo, choferAsignadoId
            FROM PedidoRecurrente WHERE clienteId = ?`,
      args: [c.id],
    });
    for (const r of recurrentes.rows) {
      console.log(`  id=${r.id.slice(0,12)} | creado=${r.creadoEn} | litros=${r.litrosSolicitados} | frecDias=${r.frecuenciaDias} | inicio=${r.fechaInicio} | proxGen=${r.fechaProximaGeneracion} | activo=${r.activo} | asignTipo=${r.asignacionTipo} | choferAsigId=${r.choferAsignadoId || 'null'}`);
    }
  }

  // 2) Buscar todos los pedidos de los próximos días (28-sep al 5-oct)
  console.log(`\n=== Todos los pedidos programados/pendientes entre 28-sep y 5-oct ===`);
  const proximos = await client.execute({
    sql: `SELECT p.id, p.creadoEn, p.fechaSolicitada, p.estado, p.pedidoRecurrenteId, p.clienteNombre,
            c.id AS clienteId, c.nombre AS clienteNombre, r.frecuenciaDias, r.fechaProximaGeneracion, r.fechaInicio
          FROM Pedido p
          LEFT JOIN Cliente c ON c.id = p.clienteId
          LEFT JOIN PedidoRecurrente r ON r.id = p.pedidoRecurrenteId
          WHERE p.fechaSolicitada >= '2026-09-28T00:00:00Z' AND p.fechaSolicitada <= '2026-10-06T00:00:00Z'
          ORDER BY p.fechaSolicitada ASC`,
  });
  for (const p of proximos.rows) {
    console.log(`  ${p.fechaSolicitada} | cliente="${p.clienteNombre || p.clienteNombre}" | estado=${p.estado} | frecDias=${p.frecuenciaDias || 'n/a'} | recId=${p.pedidoRecurrenteId ? p.pedidoRecurrenteId.slice(0,8) : 'null'} | creado=${p.creadoEn}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
