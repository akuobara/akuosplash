#!/usr/bin/env node
/**
 * Resetear planConfigsJson en AkuoConfig para que se usen los defaults del código
 * (gratis = sin MP Split, premium = Split 10day, pro = Split instant).
 *
 * Antes de resetear, hace backup del JSON actual en un archivo.
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Backup del planConfigsJson actual
  console.log('=== [1] Backup del planConfigsJson actual ===');
  const r = await client.execute("SELECT id, planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const configId = r.rows[0].id;
  const currentJson = r.rows[0].planConfigsJson;
  
  const backupFile = '/home/z/my-project/scripts/backup-planconfigs-' + Date.now() + '.json';
  fs.writeFileSync(backupFile, currentJson || '{}');
  console.log(`   ✅ Backup en: ${backupFile}`);
  console.log(`   Tamaño: ${(currentJson || '').length} chars`);
  
  // 2) Resetear planConfigsJson a NULL
  console.log('\n=== [2] Resetear planConfigsJson a NULL ===');
  await client.execute({
    sql: "UPDATE AkuoConfig SET planConfigsJson = NULL WHERE id = ?",
    args: [configId],
  });
  console.log('   ✅ planConfigsJson = NULL (se usarán los defaults del código)');
  
  // 3) Verificación
  console.log('\n=== [3] Verificación ===');
  const v = await client.execute("SELECT planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const newVal = v.rows[0].planConfigsJson;
  console.log(`   planConfigsJson: ${newVal === null ? 'NULL ✓' : `'${newVal.slice(0, 50)}...' (algo se guardó)`}`);
  
  console.log('\n=== Defaults que se van a usar ahora (según akuosplash-plans.ts): ===');
  console.log('  GRATIS:   comisión 20%, sin MP Split (subís docs tributarios), $0/mes');
  console.log('  PREMIUM:  comisión 15%, MP Split 10 días, $15.000/mes');
  console.log('  PRO:      comisión 10%, MP Split instantáneo, $50.000/mes');
  console.log('\nSi después querés customizar comisiones o precios desde el superadmin, lo podés hacer y se van a guardar.');
  console.log('\nPara hacer rollback: ejecutá el siguiente SQL en la BD (o pedímelo):');
  console.log(`  UPDATE AkuoConfig SET planConfigsJson = '<contenido de ${backupFile}>' WHERE id = '${configId}';`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
