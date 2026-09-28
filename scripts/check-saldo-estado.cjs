const { createClient } = require('@libsql/client');
async function main() {
  const client = createClient({
    url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
  });

  // 1) Config del dueno — saldo pendiente
  const cfg = await client.execute({
    sql: `SELECT duenoId, saldoPendienteLiquidacion, modoLiquidacion, periodoLiquidacion, nombreDueno, nombreChofer FROM Configuracion`
  });
  console.log('=== Configuraciones ===');
  for (const c of cfg.rows) console.log(c);

  // 2) Calcular semana actual (28-sep CL = Lunes, dayOfWeek=1)
  // startCurrent = today - 1 = 27-sep (Domingo)
  // start = 27-sep 00:00 CL = 27-sep 04:00 UTC
  // end = 04-oct 00:00 CL = 04-oct 04:00 UTC (exclusive)
  const start = '2026-09-27T04:00:00Z';
  const end = '2026-10-04T04:00:00Z';
  console.log(`\n=== Semana actual: ${start} → ${end} ===`);

  // 3) Buscar cobros de saldo anterior en esta semana
  const cobros = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, esCobroSaldoAnterior, choferId, duenoId
          FROM Pago
          WHERE duenoId = 'cmthcb85x0001ld046apm4yuu'
            AND fecha >= ? AND fecha < ?`,
    args: [start, end],
  });
  console.log(`\nPagos en esta semana: ${cobros.rows.length}`);
  for (const p of cobros.rows) {
    console.log(`  ${p.fecha} | monto=${p.monto} | metodo=${p.metodoPago} | cobroSaldo=${p.esCobroSaldoAnterior} | desc="${p.descripcion}"`);
  }

  // 4) Detectar saldoCobrado según el código del API
  const esCobroSaldo = (p) => p.esCobroSaldoAnterior === 1 || (p.descripcion && p.descripcion.toLowerCase().includes('saldo'));
  const cobrosSaldoAnt = cobros.rows.filter(p => esCobroSaldo(p));
  const cobroTotal = cobrosSaldoAnt.reduce((s, p) => s + p.monto, 0);
  const saldoCobrado = cobroTotal > 0;
  const saldoArrastrado = 148800; // del config
  const saldoAnteriorPendiente = Math.max(0, saldoArrastrado - cobroTotal);

  console.log(`\n=== Cálculo ===`);
  console.log(`saldoArrastrado (config): ${saldoArrastrado}`);
  console.log(`cobrosSaldoAnt (esta semana): ${cobroTotal}`);
  console.log(`saldoCobrado (bool): ${saldoCobrado}`);
  console.log(`saldoAnteriorPendiente: ${saldoAnteriorPendiente}`);
  console.log(`Botón "Cobrar/Pagar saldo" debería mostrarse? ${saldoArrastrado > 0 && !saldoCobrado}`);

  // 5) Verificar el pago de cobro de la semana pasada (que ya se hizo)
  const cobroPasado = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, esCobroSaldoAnterior FROM Pago
          WHERE descripcion LIKE '%Cobro de saldo%' OR esCobroSaldoAnterior = 1
          ORDER BY fecha DESC`
  });
  console.log(`\n=== Todos los pagos de cobro de saldo (histórico) ===`);
  for (const p of cobroPasado.rows) console.log(`  ${p.fecha} | monto=${p.monto} | metodo=${p.metodoPago} | cobroSaldo=${p.esCobroSaldoAnterior} | desc="${p.descripcion}"`);
}
main().catch(e => { console.error(e); process.exit(1); });
