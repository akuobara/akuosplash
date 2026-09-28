const { createClient } = require('@libsql/client');
async function main() {
  const client = createClient({
    url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
  });
  const duenoId = 'cmthcb85x0001ld046apm4yuu';

  // 1) Sumar todos los cobros de saldo anteriores (esCobroSaldoAnterior=1)
  const cobros = await client.execute({
    sql: `SELECT COALESCE(SUM(monto), 0) AS total FROM Pago WHERE duenoId = ? AND esCobroSaldoAnterior = 1`,
    args: [duenoId],
  });
  const totalCobrado = cobros.rows[0].total;
  console.log(`Total cobros de saldo anteriores: ${totalCobrado}`);

  // 2) Saldo pendiente actual
  const cfg = await client.execute({
    sql: `SELECT saldoPendienteLiquidacion FROM Configuracion WHERE duenoId = ?`,
    args: [duenoId],
  });
  const saldoActual = cfg.rows[0].saldoPendienteLiquidacion;
  console.log(`Saldo pendiente actual en config: ${saldoActual}`);

  // 3) Calcular cuánto debería quedar
  // El saldo pendiente representa "lo que el dueno aún le debe al chofer de saldos pasados no cobrados".
  // Si ya se cobró todo, debería ser 0.
  // Si el saldoActual es mayor que totalCobrado, hay algo pendiente.
  // Si saldoActual <= totalCobrado, debería ser 0 (cobrado completo).
  const nuevoSaldo = Math.max(0, saldoActual - totalCobrado);
  console.log(`Nuevo saldo pendiente calculado: ${nuevoSaldo}`);

  // 4) Actualizar config
  if (nuevoSaldo !== saldoActual) {
    const r = await client.execute({
      sql: `UPDATE Configuracion SET saldoPendienteLiquidacion = ? WHERE duenoId = ?`,
      args: [nuevoSaldo, duenoId],
    });
    console.log(`✓ Config actualizada: saldoPendienteLiquidacion = ${nuevoSaldo}`);
  } else {
    console.log('No hubo cambios necesarios.');
  }

  // 5) Verificar
  const verify = await client.execute({
    sql: `SELECT saldoPendienteLiquidacion FROM Configuracion WHERE duenoId = ?`,
    args: [duenoId],
  });
  console.log(`\nVerificación: saldoPendienteLiquidacion = ${verify.rows[0].saldoPendienteLiquidacion}`);
  console.log('Si es 0, el botón "Cobrar/Pagar saldo anterior" ya NO debería aparecer en la liquidación.');
}
main().catch(e => { console.error(e); process.exit(1); });
