const { createClient } = require('@libsql/client');
async function main() {
  const client = createClient({
    url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
  });

  // Simular el cálculo del periodo/route.ts con offset=0 (semana actual)
  // Semana: 20-sep 04:00 UTC → 27-sep 04:00 UTC
  const start = '2026-09-20T04:00:00Z';
  const end = '2026-09-27T04:00:00Z';

  // 1) Traer todos los pagos del período
  const pagos = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, nota, choferId
          FROM Pago
          WHERE duenoId = 'cmthcb85x0001ld046apm4yuu'
            AND fecha >= ? AND fecha < ?
          ORDER BY fecha DESC`,
    args: [start, end],
  });
  console.log(`=== Todos los pagos del período: ${pagos.rows.length} ===`);
  for (const p of pagos.rows) {
    console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | desc="${p.descripcion}"`);
  }

  // 2) Detectar cuales son cobro de saldo anterior (igual que el código del API)
  const esCobroSaldoAnterior = (descripcion) => {
    if (!descripcion) return false;
    const d = descripcion.toLowerCase();
    return (
      d.includes("cobro de saldo anterior") ||
      d.includes("pago de saldo") ||
      (d.includes("saldo") && (d.includes("anterior") || d.includes("liquidación") || d.includes("liquidacion")))
    );
  };

  // 3) Pagos con esCobroSaldoAnterior=1 (flag estructural)
  const flagged = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion FROM Pago
          WHERE duenoId = 'cmthcb85x0001ld046apm4yuu'
            AND esCobroSaldoAnterior = 1
            AND fecha >= ? AND fecha < ?`,
    args: [start, end],
  });
  console.log(`\n=== Pagos con esCobroSaldoAnterior=1: ${flagged.rows.length} ===`);
  const idsFlagged = new Set(flagged.rows.map(r => r.id));
  for (const p of flagged.rows) console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | desc="${p.descripcion}"`);

  // 4) Clasificar
  const cobrosSaldoAnterior = pagos.rows.filter(p => idsFlagged.has(p.id) || esCobroSaldoAnterior(p.descripcion));
  const cobroSaldoAnteriorEfectivo = cobrosSaldoAnterior.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0);
  const cobroSaldoAnteriorTransferencia = cobrosSaldoAnterior.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);
  console.log(`\ncobroSaldoAnteriorEfectivo = ${cobroSaldoAnteriorEfectivo}`);
  console.log(`cobroSaldoAnteriorTransferencia = ${cobroSaldoAnteriorTransferencia}`);
  console.log(`cobroSaldoAnteriorTotal = ${cobroSaldoAnteriorEfectivo + cobroSaldoAnteriorTransferencia}`);

  // 5) Pagos sueltos reales (excluyendo cobros de saldo)
  const pagosSueltosReales = pagos.rows.filter(p => !idsFlagged.has(p.id) && !esCobroSaldoAnterior(p.descripcion));
  console.log(`\n=== Pagos sueltos reales (no cobro de saldo): ${pagosSueltosReales.length} ===`);
  for (const p of pagosSueltosReales) {
    console.log(`  ${p.fecha} | monto=${p.monto} | metodo="${p.metodoPago}" | desc="${p.descripcion}"`);
  }
  const pagosSueltosEfectivo = pagosSueltosReales.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0);
  const pagosSueltosTransferencia = pagosSueltosReales.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);
  console.log(`pagosSueltosEfectivo = ${pagosSueltosEfectivo}`);
  console.log(`pagosSueltosTransferencia = ${pagosSueltosTransferencia}`);
}
main().catch(e => { console.error(e); process.exit(1); });
