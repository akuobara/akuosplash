// Investigar cobros de saldo anterior y su metodoPago
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Ver schema de Pago
  console.log('=== Schema Pago ===');
  const cols = await client.execute({ sql: "PRAGMA table_info(Pago)" });
  for (const c of cols.rows) console.log(`  ${c.name} | ${c.type}`);

  // 2) Buscar todos los pagos que parecen cobro de saldo anterior
  console.log('\n=== Pagos que mencionan saldo/liquidación/anterior ===');
  const pagos = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, nota, clienteId, choferId
          FROM Pago
          WHERE LOWER(descripcion || ' ' || COALESCE(nota,'')) LIKE '%saldo%'
             OR LOWER(descripcion || ' ' || COALESCE(nota,'')) LIKE '%anterior%'
             OR LOWER(descripcion || ' ' || COALESCE(nota,'')) LIKE '%liquidaci%'
          ORDER BY fecha DESC
          LIMIT 30`,
  });
  console.log(`Encontrados: ${pagos.rows.length}`);
  for (const p of pagos.rows) {
    console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | desc="${p.descripcion}" | nota="${p.nota || ''}" | choferId=${p.choferId ? p.choferId.slice(0,8) : 'null'}`);
  }

  // 3) Buscar específicamente pagos de cobro de saldo anterior del período actual (semana 20-27 sep)
  console.log('\n=== Cobros de saldo anterior de esta semana (20-27 sep CL) ===');
  const semana = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, nota
          FROM Pago
          WHERE fecha >= '2026-09-20T04:00:00Z' AND fecha < '2026-09-27T04:00:00Z'
            AND (LOWER(descripcion) LIKE '%saldo%' OR LOWER(descripcion) LIKE '%anterior%' OR LOWER(descripcion) LIKE '%liquidaci%')
          ORDER BY fecha DESC`,
  });
  for (const p of semana.rows) {
    console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | desc="${p.descripcion}"`);
  }

  // 4) Verificar también si existe esCobroSaldoAnterior columna
  try {
    const flagged = await client.execute({
      sql: `SELECT id, fecha, monto, metodoPago, descripcion FROM Pago WHERE esCobroSaldoAnterior = 1 ORDER BY fecha DESC LIMIT 10`,
    });
    console.log(`\n=== Pagos con esCobroSaldoAnterior=1: ${flagged.rows.length} ===`);
    for (const p of flagged.rows) {
      console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | desc="${p.descripcion}"`);
    }
  } catch (e) {
    console.log('\nColumna esCobroSaldoAnterior no existe.');
  }

  // 5) Configuración de saldo pendiente
  const cfg = await client.execute({
    sql: `SELECT duenoId, saldoPendienteLiquidacion, modoLiquidacion, periodoLiquidacion FROM Configuracion`,
  });
  console.log('\n=== Configuración ===');
  for (const c of cfg.rows) console.log(c);
}
main().catch(e => { console.error(e); process.exit(1); });
