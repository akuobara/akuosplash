// Simular el cálculo del saldoChofer con la nueva fórmula para ver qué ve el usuario
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const start = '2026-09-20T04:00:00Z';
  const end = '2026-09-27T04:00:00Z';
  const duenoId = 'cmthcb85x0001ld046apm4yuu';

  // 1) Total de entregas en efectivo (semana actual)
  const entregas = await client.execute({
    sql: `SELECT SUM(montoEfectivo) AS efectivo, SUM(montoTransferencia) AS transf, SUM(total) AS total, SUM(litros) AS litros, COUNT(*) AS cant
          FROM Entrega
          WHERE duenoId = ? AND fecha >= ? AND fecha < ?`,
    args: [duenoId, start, end],
  });
  console.log('=== Entregas de esta semana ===');
  console.log(entregas.rows[0]);

  // 2) Pagos sueltos (excluyendo cobro de saldo)
  const pagos = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, esCobroSaldoAnterior FROM Pago
          WHERE duenoId = ? AND fecha >= ? AND fecha < ?`,
    args: [duenoId, start, end],
  });
  console.log(`\n=== Pagos sueltos: ${pagos.rows.length} ===`);
  for (const p of pagos.rows) console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | cobroSaldo=${p.esCobroSaldoAnterior} | desc="${p.descripcion}"`);

  const esCobroSaldo = (p) => p.esCobroSaldoAnterior === 1 || (p.descripcion && p.descripcion.toLowerCase().includes('cobro de saldo'));
  const pagosReales = pagos.rows.filter(p => !esCobroSaldo(p));
  const pagosEfectivo = pagosReales.filter(p => p.metodoPago === 'efectivo').reduce((s,p) => s + p.monto, 0);
  const pagosTransf = pagosReales.filter(p => p.metodoPago === 'transferencia').reduce((s,p) => s + p.monto, 0);
  const cobros = pagos.rows.filter(p => esCobroSaldo(p));
  const cobroEfectivo = cobros.filter(p => p.metodoPago === 'efectivo').reduce((s,p) => s + p.monto, 0);
  const cobroTransf = cobros.filter(p => p.metodoPago === 'transferencia').reduce((s,p) => s + p.monto, 0);

  // 3) Configuración
  const cfg = await client.execute({
    sql: `SELECT saldoPendienteLiquidacion, modoLiquidacion, montoPorVueltaUnicoCliente, montoPorVueltaMultiple, capacidadCamion, umbralCompletacionVuelta FROM Configuracion WHERE duenoId = ?`,
    args: [duenoId],
  });
  console.log('\n=== Config ===');
  console.log(cfg.rows[0]);

  // 4) Vueltas válidas (cerradas en esta semana)
  const vueltas = await client.execute({
    sql: `SELECT v.id, v.numero, v.iniciadaEn, v.cerradaEn, v.activa,
            c.capacidad AS camionCapacidad,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) AS numEntregas,
            (SELECT SUM(litros) FROM Entrega e WHERE e.vueltaId = v.id) AS litros
          FROM Vuelta v
          LEFT JOIN Camion c ON c.id = v.camionId
          WHERE v.duenoId = ? AND v.activa = 0 AND v.cerradaEn >= ? AND v.cerradaEn < ?`,
    args: [duenoId, start, end],
  });
  console.log(`\n=== Vueltas cerradas esta semana: ${vueltas.rows.length} ===`);
  let vueltasValidasUnico = 0;
  let vueltasValidasMultiple = 0;
  const umbral = cfg.rows[0].umbralCompletacionVuelta || 0.975;
  for (const v of vueltas.rows) {
    const cap = v.camionCapacidad || cfg.rows[0].capacidadCamion || 0;
    const completada = cap > 0 ? v.litros >= cap * umbral : v.litros >= 1000;
    console.log(`  #${v.numero} | litros=${v.litros}/${cap} | ${completada ? '✓' : '✗'} | entregas=${v.numEntregas}`);
    if (completada) {
      if (v.numEntregas > 1) vueltasValidasMultiple++;
      else vueltasValidasUnico++;
    }
  }
  const pagoChofer = vueltasValidasUnico * (cfg.rows[0].montoPorVueltaUnicoCliente || 0) + vueltasValidasMultiple * (cfg.rows[0].montoPorVueltaMultiple || 0);
  console.log(`\nVueltas válidas: ${vueltasValidasUnico} único + ${vueltasValidasMultiple} múltiple = ${vueltasValidasUnico + vueltasValidasMultiple} total`);
  console.log(`Pago chofer = ${pagoChofer}`);

  // 5) Gastos
  const gastos = await client.execute({
    sql: `SELECT SUM(monto) AS total, SUM(CASE WHEN pagadoPor='chofer' THEN monto ELSE 0 END) AS chofer FROM Gasto WHERE duenoId = ? AND fecha >= ? AND fecha < ?`,
    args: [duenoId, start, end],
  });
  console.log(`\nGastos: total=${gastos.rows[0].total}, chofer=${gastos.rows[0].chofer}`);

  const liquidoChofer = Math.max(0, pagoChofer) + gastos.rows[0].chofer; // sin descuentos ni impuesto por ahora
  const totalEfectivo = entregas.rows[0].efectivo || 0;
  const efectivoTotal = totalEfectivo + pagosEfectivo;

  console.log('\n=== RESUMEN ===');
  console.log(`liquidoChofer = ${liquidoChofer}`);
  console.log(`totalEfectivo (entregas) = ${totalEfectivo}`);
  console.log(`pagosSueltosEfectivo = ${pagosEfectivo}`);
  console.log(`pagosSueltosTransferencia = ${pagosTransf}`);
  console.log(`efectivoTotal = ${efectivoTotal}`);
  console.log(`saldoArrastrado = ${cfg.rows[0].saldoPendienteLiquidacion}`);
  console.log(`cobroSaldoAnteriorTotal = ${cobroEfectivo + cobroTransf}`);
  console.log(`cobroSaldoAnteriorTransferencia = ${cobroTransf}`);
  console.log(`cobroSaldoAnteriorEfectivo = ${cobroEfectivo}`);

  const saldoAnteriorPendiente = Math.max(0, (cfg.rows[0].saldoPendienteLiquidacion || 0) - (cobroEfectivo + cobroTransf));
  const saldoChofer = liquidoChofer - efectivoTotal;
  const saldoChoferTotal = saldoChofer + saldoAnteriorPendiente;

  console.log('\n=== CÁLCULO FINAL ===');
  console.log(`saldoChofer (esta semana) = ${liquidoChofer} - ${efectivoTotal} = ${saldoChofer}`);
  console.log(`saldoAnteriorPendiente = ${saldoAnteriorPendiente}`);
  console.log(`saldoChoferTotal = ${saldoChoferTotal}`);
}
main().catch(e => { console.error(e); process.exit(1); });
