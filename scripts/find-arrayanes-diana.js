// Investigar el caso "arrayanes j3" / "Diana Ibañez" — cliente parece haber desaparecido
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Buscar todos los clientes que matcheen "arrayan" o "diana" (case insensitive)
  console.log('=== Búsqueda por nombre ===');
  const r1 = await client.execute({
    sql: `SELECT id, nombre, telefono, direccion, duenoId, creadoEn,
            (SELECT COUNT(*) FROM Entrega e WHERE e.clienteId = Cliente.id) AS numEntregas,
            (SELECT COUNT(*) FROM Pedido p WHERE p.clienteId = Cliente.id) AS numPedidos
          FROM Cliente
          WHERE LOWER(nombre) LIKE '%arrayan%' OR LOWER(nombre) LIKE '%diana%'
          ORDER BY creadoEn DESC`,
  });
  for (const c of r1.rows) {
    console.log(`  id=${c.id.slice(0,12)} | nombre="${c.nombre}" | tel=${c.telefono} | dir=${c.direccion} | entregas=${c.numEntregas} | pedidos=${c.numPedidos} | creado=${c.creadoEn}`);
  }

  // 2) Buscar pedidos con clienteNombre = "arrayanes j3"
  console.log('\n=== Pedidos con clienteNombre="arrayanes j3" (o similar) ===');
  const r2 = await client.execute({
    sql: `SELECT id, clienteId, clienteNombre, clienteDireccion, estado, creadoEn, fechaSolicitada, pedidoRecurrenteId
          FROM Pedido
          WHERE LOWER(clienteNombre) LIKE '%arrayan%' OR LOWER(clienteNombre) LIKE '%diana%'
          ORDER BY creadoEn DESC
          LIMIT 20`,
  });
  for (const p of r2.rows) {
    console.log(`  id=${p.id.slice(0,12)} | clienteId=${p.clienteId ? p.clienteId.slice(0,12) : 'NULL'} | nombre="${p.clienteNombre}" | estado=${p.estado} | fecha=${p.fechaSolicitada} | recId=${p.pedidoRecurrenteId ? p.pedidoRecurrenteId.slice(0,8) : 'null'}`);
  }

  // 3) Buscar también en Entregas recientes con nombre similar
  console.log('\n=== Entregas recientes con clienteNombre similar ===');
  const r3 = await client.execute({
    sql: `SELECT id, clienteId, clienteNombre, fecha, vueltaId, choferId
          FROM Entrega
          WHERE LOWER(clienteNombre) LIKE '%arrayan%' OR LOWER(clienteNombre) LIKE '%diana%'
          ORDER BY fecha DESC
          LIMIT 10`,
  });
  for (const e of r3.rows) {
    console.log(`  ${e.fecha} | clienteId=${e.clienteId ? e.clienteId.slice(0,12) : 'NULL'} | nombre="${e.clienteNombre}" | choferId=${e.choferId ? e.choferId.slice(0,8) : 'null'}`);
  }

  // 4) Buscar clientes modificados en las últimas 2 horas
  console.log('\n=== Clientes modificados/creados en últimas 24h ===');
  const r4 = await client.execute({
    sql: `SELECT id, nombre, telefono, creadoEn
          FROM Cliente
          WHERE creadoEn >= datetime('now', '-2 days')
          ORDER BY creadoEn DESC
          LIMIT 30`,
  });
  for (const c of r4.rows) {
    console.log(`  ${c.creadoEn} | id=${c.id.slice(0,12)} | nombre="${c.nombre}" | tel=${c.telefono}`);
  }

  // 5) Total clientes en la BD
  const r5 = await client.execute({ sql: "SELECT COUNT(*) AS c FROM Cliente" });
  console.log(`\nTotal clientes en BD: ${r5.rows[0].c}`);
}
main().catch(e => { console.error(e); process.exit(1); });
