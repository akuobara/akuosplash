#!/usr/bin/env node
/**
 * Corrige deudas fantasma en AljibeApp:
 *
 * RUTA 33 (id=cmthig0xe0009l3040a787hcc) — debería tener $0 de deuda:
 *   - Entrega jr06457b2d4p (2026-10-09, 800L, total $4800) → marcar pagada
 *   - Entrega jr04dv6vav4x (2026-10-05, 900L, total $5400) → marcar pagada
 *   - Entrega la04sd7gimc3 (2026-09-23, 430L, total $2600) → marcar pagada
 *
 * ALMÁCIGOS (id=cmthi166h0003jr04l67111a8) — deuda real = $45400 (última entrega 2026-10-22):
 *   - Entrega l406nnmg9x20 (2026-10-14, 4800L, total $38400, recibido $26500) → ajustar recibido=$38400, estado=pagado
 *   - Entrega jy0435cwc7ko (2026-10-01, 4500L, total $36000, recibido $0) → ajustar recibido=$36000, estado=pagado
 *   - Entrega l507u2xqlidf (2026-10-22, 5700L, total $45600, recibido $0) → NO tocar (deuda real)
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const ENTREGAS_A_CORREGIR = [
  { id: 'jr06457b2d4p', razon: 'Ruta 33 — pago fantasma de 800L el 2026-10-09', totalEsperado: 4800 },
  { id: 'jr04dv6vav4x', razon: 'Ruta 33 — pago fantasma de 900L el 2026-10-05', totalEsperado: 5400 },
  { id: 'la04sd7gimc3', razon: 'Ruta 33 — pago fantasma de 430L el 2026-09-23', totalEsperado: 2600 },
  { id: 'l406nnmg9x20', razon: 'Almácigos — entrega parcial 14-10, cliente pagó los $38400 pero solo se cargó $26500', totalEsperado: 38400 },
  { id: 'jy0435cwc7ko', razon: 'Almácigos — entrega 01-10 pagada pero cargada como pendiente', totalEsperado: 36000 },
];

async function main() {
  // 1) BACKUP — guardar el estado actual de las 5 entregas en un archivo
  console.log('==> [1/4] BACKUP de las 5 entregas');
  const backupFile = '/home/z/my-project/scripts/backup-entregas-' + Date.now() + '.sql';
  let backupContent = '-- Backup de entregas antes de corrección de deudas fantasma\n';
  backupContent += '-- Fecha: ' + new Date().toISOString() + '\n\n';
  
  for (const e of ENTREGAS_A_CORREGIR) {
    // Buscar el ID completo (las entregas tienen IDs largos)
    const r = await client.execute({
      sql: "SELECT * FROM Entrega WHERE id LIKE ?",
      args: ['%' + e.id],
    });
    if (r.rows.length === 0) {
      console.error(`❌ No encontré la entrega que termina en ${e.id}`);
      process.exit(1);
    }
    const row = r.rows[0];
    console.log(`   ✓ Backup de ${e.id} (id completo: ${row.id})`);
    // Generar INSERT para backup
    const cols = Object.keys(row).filter(k => row[k] !== undefined);
    const vals = cols.map(c => {
      const v = row[c];
      if (v === null) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${String(v).replace(/'/g, "''")}'`;
    });
    backupContent += `-- ${e.razon}\n`;
    backupContent += `DELETE FROM Entrega WHERE id='${row.id}';\n`;
    backupContent += `INSERT INTO Entrega (${cols.join(',')}) VALUES (${vals.join(',')});\n\n`;
  }
  fs.writeFileSync(backupFile, backupContent);
  console.log(`   ✅ Backup guardado en: ${backupFile}`);

  // 2) APLICAR CORRECCIONES — en una transacción
  console.log('\n==> [2/4] Aplicar correcciones');
  // Turso/libsql con @libsql/client soporta batch
  const batchStmts = [];
  for (const e of ENTREGAS_A_CORREGIR) {
    // UPDATE Entrega SET montoRecibido = ?, estadoPago = 'pagado' WHERE id LIKE ?
    batchStmts.push({
      sql: "UPDATE Entrega SET montoRecibido = ?, estadoPago = 'pagado' WHERE id LIKE ?",
      args: [e.totalEsperado, '%' + e.id],
    });
    console.log(`   ✓ UPDATE entrega ${e.id} → montoRecibido=$${e.totalEsperado}, estado=pagado`);
  }
  
  try {
    const res = await client.batch(batchStmts, 'write');
    console.log(`   ✅ Batch ejecutado OK (${batchStmts.length} updates)`);
  } catch (err) {
    console.error(`❌ Error en batch:`, err.message);
    process.exit(1);
  }

  // 3) VERIFICAR el resultado
  console.log('\n==> [3/4] Verificación de deudas después de la corrección');
  
  for (const [nombre, clienteId] of [
    ['RUTA 33', 'cmthig0xe0009l3040a787hcc'],
    ['ALMÁCIGOS', 'cmthi166h0003jr04l67111a8'],
  ]) {
    const entregas = await client.execute({
      sql: `SELECT id, fecha, litros, total, montoRecibido, estadoPago
            FROM Entrega WHERE clienteId = ? AND estadoPago != 'pagado' ORDER BY fecha DESC`,
      args: [clienteId],
    });
    let deudaTotal = 0;
    console.log(`\n   ${nombre}: entregas NO pagadas después de corrección = ${entregas.rows.length}`);
    for (const r of entregas.rows) {
      const saldo = (r.total || 0) - (r.montoRecibido || 0);
      deudaTotal += saldo;
      console.log(`     - ${r.fecha} | ${r.id.slice(-12)} | total=$${r.total} | recibido=$${r.montoRecibido} | estado=${r.estadoPago} | SALDO=$${saldo}`);
    }
    console.log(`   >>> Deuda TOTAL ${nombre}: $${deudaTotal}`);
  }

  // 4) Resumen
  console.log('\n==> [4/4] Resumen');
  console.log('   - Ruta 33: deuda esperada $0');
  console.log('   - Almácigos: deuda esperada $45400 (o $45600 según datos de la última entrega del 22-10)');
  console.log('   - Backup disponible en:', backupFile);
}

main().catch(e => {
  console.error('ERROR FATAL:', e.message);
  process.exit(1);
});
