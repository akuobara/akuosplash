#!/usr/bin/env node
/**
 * Borra el Pago duplicado en tabla Pago para Almácigos.
 *
 * Contexto: Antes de mi fix anterior, había 1 entrega del 01-10 con saldo $36000
 * Y un Pago aparte de $36000 en tabla Pago (del 08-10). La app calculaba:
 * deuda = $36000 (saldo entregas) - $36000 (Pago en Pago table) = $0 (correcto)
 *
 * Mi fix anterior marcó la entrega como pagada, dejando el Pago duplicando:
 * deuda = $0 (entregas saldadas) - $36000 (Pago en Pago table) = -$36000 (negativo!)
 * 
 * Pero sumando la entrega pendiente del 22-10 ($45600), la app muestra:
 * $45600 - $36000 = $9600 (lo que ve el usuario ahora, incorrecto)
 *
 * Solución: borrar el Pago de $36000 del 08-10 (ya no es necesario porque
 * la entrega del 01-10 quedó marcada como pagada en el fix anterior).
 * 
 * Resultado esperado: $45600 - $0 = $45600 (deuda real de la última entrega)
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const CLIENTE_ALMACIGO = 'cmthi166h0003jr04l67111a8';

async function main() {
  // 1) Buscar el Pago de $36000 del 08-10 (sin descripcion ni nota, sin esCobroSaldoAnterior)
  console.log('==> [1/3] Buscar el Pago de $36000 a borrar');
  const pagos = await client.execute({
    sql: `SELECT id, fecha, monto, metodoPago, descripcion, nota FROM Pago
          WHERE clienteId = ? AND monto = 36000
          ORDER BY fecha DESC`,
    args: [CLIENTE_ALMACIGO],
  });
  console.log(`   Encontrados: ${pagos.rows.length}`);
  
  if (pagos.rows.length === 0) {
    console.error('   ❌ No encontré el Pago. Aborto.');
    process.exit(1);
  }
  
  const pagoABorrar = pagos.rows[0];
  console.log(`   Pago a borrar: ${pagoABorrar.id} | ${pagoABorrar.fecha} | $${pagoABorrar.monto} | ${pagoABorrar.metodoPago}`);
  
  // 2) Backup del Pago
  console.log('\n==> [2/3] Backup del Pago');
  const backupFile = '/home/z/my-project/scripts/backup-pago-almacigo-' + Date.now() + '.sql';
  let backup = '-- Backup del Pago de $36000 de Almácigos antes de borrar\n';
  backup += '-- Fecha: ' + new Date().toISOString() + '\n';
  backup += '-- Razón: Pago duplicado por mi fix anterior de la entrega del 01-10\n\n';
  
  const cols = Object.keys(pagoABorrar);
  const vals = cols.map(c => {
    const v = pagoABorrar[c];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return String(v);
    return `'${String(v).replace(/'/g, "''")}'`;
  });
  backup += `INSERT INTO Pago (${cols.join(',')}) VALUES (${vals.join(',')});\n`;
  fs.writeFileSync(backupFile, backup);
  console.log(`   ✅ Backup en: ${backupFile}`);
  
  // 3) Borrar el Pago
  console.log('\n==> [3/3] DELETE Pago');
  try {
    const res = await client.execute({
      sql: "DELETE FROM Pago WHERE id = ?",
      args: [pagoABorrar.id],
    });
    console.log(`   ✅ Borrado OK. Filas afectadas: ${res.rowsAffected || '?'}`);
  } catch (e) {
    console.error('   ❌ Error al borrar:', e.message);
    process.exit(1);
  }
  
  // 4) Verificación final
  console.log('\n==> Verificación final de deudas');
  for (const [nombre, clienteId] of [
    ['RUTA 33', 'cmthig0xe0009l3040a787hcc'],
    ['ALMÁCIGOS', CLIENTE_ALMACIGO],
  ]) {
    const entregas = await client.execute({
      sql: `SELECT total, montoRecibido, estadoPago FROM Entrega WHERE clienteId = ? AND estadoPago != 'pagado'`,
      args: [clienteId],
    });
    let sumSaldo = 0;
    for (const r of entregas.rows) {
      sumSaldo += (r.total || 0) - (r.montoRecibido || 0);
    }
    
    const pagos = await client.execute({
      sql: "SELECT COALESCE(SUM(monto), 0) as total FROM Pago WHERE clienteId = ?",
      args: [clienteId],
    });
    const sumPagos = pagos.rows[0].total || 0;
    
    console.log(`\n   ${nombre}:`);
    console.log(`     Saldo Entregas: $${sumSaldo}`);
    console.log(`     Pagos tabla Pago: $${sumPagos}`);
    console.log(`     Deuda calculada (A - B): $${sumSaldo - sumPagos}`);
  }
}

main().catch(e => {
  console.error('ERROR FATAL:', e.message);
  process.exit(1);
});
