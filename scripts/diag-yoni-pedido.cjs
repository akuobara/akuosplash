// Investigar por qué el pedido de Yoni sigue en estado pendiente aunque fue entregado
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Buscar el cliente Yoni
  console.log('=== Buscar cliente Yoni ===');
  const clientes = await client.execute({
    sql: `SELECT id, nombre, duenoId FROM Cliente WHERE LOWER(nombre) LIKE '%yoni%' OR LOWER(nombre) LIKE '%johnny%'`,
  });
  for (const c of clientes.rows) console.log(`  id=${c.id} | nombre="${c.nombre}" | duenoId=${c.duenoId.slice(0,8)}`);

  if (clientes.rows.length === 0) {
    console.log('No se encontró cliente Yoni. Buscando pedidos con clienteNombre Yoni...');
  }

  // 2) Buscar todos los pedidos de Yoni
  console.log('\n=== Pedidos de Yoni ===');
  const pedidos = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado, clienteId, clienteNombre, entregaId, choferId, pedidoRecurrenteId, nota, asignacionTipo, tomadoPorChoferId
          FROM Pedido
          WHERE LOWER(clienteNombre) LIKE '%yoni%' OR LOWER(clienteNombre) LIKE '%johnny%'
          ORDER BY creadoEn DESC LIMIT 10`,
  });
  for (const p of pedidos.rows) {
    console.log(`  id=${p.id.slice(0,12)} | creado=${p.creadoEn} | solicitado=${p.fechaSolicitada} | estado=${p.estado} | clienteId=${p.clienteId ? p.clienteId.slice(0,8) : 'null'} | entregaId=${p.entregaId ? p.entregaId.slice(0,8) : 'NULL'} | choferId=${p.choferId ? p.choferId.slice(0,8) : 'null'} | recId=${p.pedidoRecurrenteId ? 'recurrente' : 'manual'}`);
  }

  // 3) Buscar entregas a Yoni recientes (por clienteNombre)
  console.log('\n=== Entregas a Yoni ===');
  const entregas = await client.execute({
    sql: `SELECT id, fecha, clienteId, clienteNombre, litros, total, montoRecibido, choferId, vueltaId, estadoPago
          FROM Entrega
          WHERE LOWER(clienteNombre) LIKE '%yoni%' OR LOWER(clienteNombre) LIKE '%johnny%'
          ORDER BY fecha DESC LIMIT 10`,
  });
  for (const e of entregas.rows) {
    console.log(`  id=${e.id.slice(0,12)} | fecha=${e.fecha} | clienteId=${e.clienteId ? e.clienteId.slice(0,8) : 'null'} | litros=${e.litros} | total=${e.total} | choferId=${e.choferId ? e.choferId.slice(0,8) : 'null'} | estadoPago=${e.estadoPago}`);
  }

  // 4) Para cada entrega, buscar si hay un pedido vinculado con entregaId = entrega.id
  console.log('\n=== Verificar vínculo pedido ↔ entrega ===');
  for (const e of entregas.rows) {
    const pedidoVinculado = await client.execute({
      sql: `SELECT id, estado, clienteNombre FROM Pedido WHERE entregaId = ?`,
      args: [e.id],
    });
    if (pedidoVinculado.rows.length === 0) {
      console.log(`  Entrega ${e.id.slice(0,12)} (${e.fecha}, "${e.clienteNombre}") → NO tiene pedido vinculado`);
    } else {
      for (const p of pedidoVinculado.rows) {
        console.log(`  Entrega ${e.id.slice(0,12)} (${e.fecha}) → pedido ${p.id.slice(0,12)} estado=${p.estado} cliente="${p.clienteNombre}"`);
      }
    }
  }

  // 5) Pedidos pendientes hoy de Yoni (los que el usuario ve en la lista)
  console.log('\n=== Pedidos pendientes/programados de Yoni (hoy y futuro) ===');
  const pendientes = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado, clienteNombre, entregaId, nota
          FROM Pedido
          WHERE (LOWER(clienteNombre) LIKE '%yoni%' OR LOWER(clienteNombre) LIKE '%johnny%')
            AND estado IN ('pendiente', 'programado')
          ORDER BY creadoEn DESC`,
  });
  for (const p of pendientes.rows) {
    console.log(`  id=${p.id.slice(0,12)} | creado=${p.creadoEn} | solicitado=${p.fechaSolicitada} | estado=${p.estado} | entregaId=${p.entregaId ? 'vinculado' : 'NULL'} | nota="${p.nota || ''}"`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
