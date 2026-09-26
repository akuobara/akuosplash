// Ver directamente el cliente cmtyp779u y ver si fue renombrado o borrado
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const clienteId = 'cmtyp779u0002l804nrqjxkrp'; // probable prefix
  console.log('=== Buscar cliente por prefix de id ===');
  // Buscar el cliente con LIKE prefix
  const r = await client.execute({
    sql: `SELECT id, nombre, telefono, email, direccion, rut, duenoId, choferPreferidoId, creadoEn,
            (SELECT COUNT(*) FROM Entrega e WHERE e.clienteId = Cliente.id) AS numEntregas,
            (SELECT COUNT(*) FROM Pedido p WHERE p.clienteId = Cliente.id) AS numPedidos
          FROM Cliente
          WHERE id LIKE 'cmtyp779u%'`,
  });
  if (r.rows.length === 0) {
    console.log('Cliente cmtyp779u NO existe más. Probablemente fue borrado.');
  }
  for (const c of r.rows) console.log(c);

  // Ver si hay BitacoraCamion o audit log de la operación
  console.log('\n=== Audit log reciente (cambios en clientes) ===');
  try {
    const r2 = await client.execute({
      sql: `SELECT * FROM AuditLog ORDER BY creadoEn DESC LIMIT 10`,
    });
    console.log(`AuditLog existe, ${r2.rows.length} entries.`);
    for (const row of r2.rows) console.log('  ', row);
  } catch (e) {
    console.log('AuditLog table no existe o error:', e.message);
  }

  // Buscar el último pedido con clienteId = cmtyp779u*
  console.log('\n=== Pedido más reciente con ese clienteId ===');
  const r3 = await client.execute({
    sql: `SELECT id, clienteId, clienteNombre, clienteDireccion, estado, creadoEn
          FROM Pedido
          WHERE clienteId LIKE 'cmtyp779u%'
          ORDER BY creadoEn DESC LIMIT 5`,
  });
  for (const p of r3.rows) console.log('  ', p);

  // Entregas con ese clienteId
  console.log('\n=== Últimas 3 entregas con ese clienteId ===');
  const r4 = await client.execute({
    sql: `SELECT id, fecha, clienteId, clienteNombre, total, montoRecibido
          FROM Entrega
          WHERE clienteId LIKE 'cmtyp779u%'
          ORDER BY fecha DESC LIMIT 3`,
  });
  for (const e of r4.rows) console.log('  ', e);

  // Listar TODOS los clientes creados/modificados hoy (26-sep)
  console.log('\n=== Todos los clientes con creadoEn >= 2026-09-25 ===');
  const r5 = await client.execute({
    sql: `SELECT id, nombre, telefono, creadoEn FROM Cliente WHERE creadoEn >= '2026-09-25' ORDER BY creadoEn DESC`,
  });
  for (const c of r5.rows) console.log(`  ${c.creadoEn} | id=${c.id.slice(0,12)} | nombre="${c.nombre}" | tel=${c.telefono}`);
}
main().catch(e => { console.error(e); process.exit(1); });
