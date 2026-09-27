const { createClient } = require('@libsql/client');
async function main() {
  const client = createClient({
    url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
  });
  // Verificar la detección del cobro según el código del API
  const start = '2026-09-20T04:00:00Z';
  const end = '2026-09-27T04:00:00Z';
  const duenoId = 'cmthcb85x0001ld046apm4yuu';

  // Flag estructural
  const flagged = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, esCobroSaldoAnterior
          FROM Pago
          WHERE duenoId = ? AND esCobroSaldoAnterior = 1 AND fecha >= ? AND fecha < ?`,
    args: [duenoId, start, end],
  });
  console.log('Pagos con esCobroSaldoAnterior=1:', flagged.rows.length);
  for (const p of flagged.rows) console.log(`  ${p.fecha} | ${p.metodoPago} | ${p.monto} | "${p.descripcion}"`);

  // Pagos con descripción que mencione saldo
  const descMatch = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion
          FROM Pago
          WHERE duenoId = ? AND fecha >= ? AND fecha < ?
            AND (LOWER(descripcion) LIKE '%saldo%' OR LOWER(descripcion) LIKE '%anterior%' OR LOWER(descripcion) LIKE '%liquidaci%')`,
    args: [duenoId, start, end],
  });
  console.log(`\nPagos con descripcion que mencione saldo/anterior/liquidacion: ${descMatch.rows.length}`);
  for (const p of descMatch.rows) console.log(`  ${p.fecha} | ${p.metodoPago} | ${p.monto} | "${p.descripcion}"`);

  // Gastos fantasma
  const gastos = await client.execute({
    sql: `SELECT id, fecha, monto, descripcion, tipo, pagadoPor
          FROM Gasto
          WHERE duenoId = ? AND fecha >= ? AND fecha < ?
            AND (LOWER(COALESCE(descripcion,'')) LIKE '%saldo%' OR LOWER(COALESCE(descripcion,'')) LIKE '%anterior%' OR LOWER(COALESCE(descripcion,'')) LIKE '%liquidaci%')`,
    args: [duenoId, start, end],
  });
  console.log(`\nGastos fantasma: ${gastos.rows.length}`);
  for (const g of gastos.rows) console.log(`  ${g.fecha} | ${g.monto} | "${g.descripcion}" | tipo=${g.tipo} | pagadoPor=${g.pagadoPor}`);

  // SaldoPendiente en config
  const cfg = await client.execute({
    sql: `SELECT saldoPendienteLiquidacion FROM Configuracion WHERE duenoId = ?`,
    args: [duenoId],
  });
  console.log(`\nSaldoPendienteLiquidacion: ${cfg.rows[0].saldoPendienteLiquidacion}`);

  // Cálculo de saldoCobrado y saldoAnteriorPendiente según el código del API
  const cobroSaldoAnteriorTotal = flagged.rows.reduce((s, p) => s + p.monto, 0);
  const saldoCobrado = cobroSaldoAnteriorTotal > 0;
  const saldoArrastrado = cfg.rows[0].saldoPendienteLiquidacion;
  const saldoAnteriorPendiente = Math.max(0, saldoArrastrado - cobroSaldoAnteriorTotal);
  console.log(`\n=== Cálculo según el código del API ===`);
  console.log(`cobroSaldoAnteriorTotal = ${cobroSaldoAnteriorTotal}`);
  console.log(`saldoCobrado = ${saldoCobrado}`);
  console.log(`saldoArrastrado = ${saldoArrastrado}`);
  console.log(`saldoAnteriorPendiente = ${saldoAnteriorPendiente}`);
  console.log(`Botón "Cobrar/Pagar saldo" debería mostrarse? ${saldoArrastrado > 0 && !saldoCobrado}`);
  console.log(`Sección aparte (amber box) debería mostrarse? ${saldoArrastrado > 0 && saldoAnteriorPendiente > 0}`);
}
main().catch(e => { console.error(e); process.exit(1); });
