const { createClient } = require('@libsql/client');
async function main() {
  const client = createClient({
    url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
  });
  const duenoId = 'cmthcb85x0001ld046apm4yuu';

  // 1) Configuración: saldo pendiente
  const cfg = await client.execute({
    sql: `SELECT saldoPendienteLiquidacion, modoLiquidacion, periodoLiquidacion FROM Configuracion WHERE duenoId = ?`,
    args: [duenoId],
  });
  console.log('=== Config ===');
  console.log(cfg.rows[0]);

  // 2) Pagos con cobro de saldo anterior (todos los del año)
  const cobros = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, esCobroSaldoAnterior FROM Pago
          WHERE duenoId = ? AND esCobroSaldoAnterior = 1
          ORDER BY fecha DESC LIMIT 10`,
    args: [duenoId],
  });
  console.log(`\n=== Cobros de saldo anteriores (esCobroSaldoAnterior=1): ${cobros.rows.length} ===`);
  for (const c of cobros.rows) console.log(`  ${c.fecha} | monto=${c.monto} | metodo="${c.metodoPago}" | desc="${c.descripcion}"`);

  // 3) Período actual (semana 27-sep al 4-oct CL si es semanal)
  // 27-sep 04:00 UTC = 27-sep 00:00 CL (sábado). Pero hoy es 28-sep (domingo). todayDow = 0.
  // startCurrent = hoy - todayDow = hoy - 0 = 27-sep
  // start = 27-sep 04:00 UTC, end = 4-oct 04:00 UTC (excluye domingo siguiente)
  const start = '2026-09-27T04:00:00Z';
  const end = '2026-10-04T04:00:00Z';

  // Pagos con cobro de saldo anterior en el período actual
  const cobrosPeriodo = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, esCobroSaldoAnterior FROM Pago
          WHERE duenoId = ? AND fecha >= ? AND fecha < ?`,
    args: [duenoId, start, end],
  });
  console.log(`\n=== Pagos en período actual (${start} → ${end}): ${cobrosPeriodo.rows.length} ===`);
  for (const p of cobrosPeriodo.rows) console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | cobroSaldo=${p.esCobroSaldoAnterior} | desc="${p.descripcion}"`);

  const esCobroSaldo = (p) => p.esCobroSaldoAnterior === 1 || (p.descripcion && p.descripcion.toLowerCase().includes('cobro de saldo'));
  const cobrosEstePeriodo = cobrosPeriodo.rows.filter(esCobroSaldo);
  const cobroTotal = cobrosEstePeriodo.reduce((s,p) => s + p.monto, 0);
  console.log(`\nCobros en este período: ${cobrosEstePeriodo.length} | monto total: ${cobroTotal}`);

  const saldoArrastrado = cfg.rows[0].saldoPendienteLiquidacion || 0;
  const saldoCobrado = cobroTotal > 0;
  console.log(`\n=== Estado según código del API ===`);
  console.log(`saldoArrastrado (de config): ${saldoArrastrado}`);
  console.log(`saldoCobrado (cobroTotal > 0): ${saldoCobrado}`);
  console.log(`Botón "Cobrar/Pagar saldo" debería mostrarse? ${saldoArrastrado > 0 && !saldoCobrado}`);

  // 4) También checkear gastos fantasma
  const gastos = await client.execute({
    sql: `SELECT id, fecha, monto, descripcion, tipo, pagadoPor FROM Gasto
          WHERE duenoId = ? AND fecha >= ? AND fecha < ?
            AND (LOWER(COALESCE(descripcion,'')) LIKE '%saldo%' OR LOWER(COALESCE(descripcion,'')) LIKE '%anterior%' OR LOWER(COALESCE(descripcion,'')) LIKE '%liquidaci%')`,
    args: [duenoId, start, end],
  });
  console.log(`\nGastos fantasma: ${gastos.rows.length}`);
}
main().catch(e => { console.error(e); process.exit(1); });
