#!/usr/bin/env node
/**
 * Actualiza planConfigsJson en AkuoConfig:
 *   - gratis.features.vehiculo = false
 *   - gratis.features.equipo = false
 *   - premium.features.vehiculo = false
 *   - premium.features.equipo = false
 *   - pago.features.vehiculo = false
 *   - pago.features.equipo = false
 * (pro queda igual — esos features true para plan Pro que tiene tabs dedicados)
 *
 * Antes de modificar, hace backup del JSON actual.
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Leer el JSON actual
  const r = await client.execute("SELECT id, planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const configId = r.rows[0].id;
  const jsonStr = r.rows[0].planConfigsJson;
  
  // Backup
  const backupFile = '/home/z/my-project/scripts/backup-planconfigs-before-vehiculo-fix-' + Date.now() + '.json';
  fs.writeFileSync(backupFile, jsonStr || '{}');
  console.log(`✅ Backup en: ${backupFile}`);
  
  if (!jsonStr) {
    console.log('planConfigsJson es NULL — no hay nada que modificar (se usarán defaults del código).');
    return;
  }
  
  const parsed = JSON.parse(jsonStr);
  console.log(`\nEstado actual:`);
  for (const pid of ['gratis', 'premium', 'pago', 'pro']) {
    if (parsed[pid]) {
      console.log(`  ${pid}.features.vehiculo = ${parsed[pid].features?.vehiculo}`);
      console.log(`  ${pid}.features.equipo = ${parsed[pid].features?.equipo}`);
    }
  }
  
  // 2) Modificar vehiculo y equipo en gratis, premium, pago (Pro queda igual)
  for (const pid of ['gratis', 'premium', 'pago']) {
    if (parsed[pid] && parsed[pid].features) {
      parsed[pid].features.vehiculo = false;
      parsed[pid].features.equipo = false;
    }
  }
  
  // 3) Guardar
  const newJson = JSON.stringify(parsed);
  await client.execute({
    sql: "UPDATE AkuoConfig SET planConfigsJson = ? WHERE id = ?",
    args: [newJson, configId],
  });
  
  console.log(`\n✅ Actualizado. Estado nuevo:`);
  for (const pid of ['gratis', 'premium', 'pago', 'pro']) {
    if (parsed[pid]) {
      console.log(`  ${pid}.features.vehiculo = ${parsed[pid].features?.vehiculo}`);
      console.log(`  ${pid}.features.equipo = ${parsed[pid].features?.equipo}`);
    }
  }
  
  console.log(`\nPara rollback: pegá el contenido de ${backupFile} en el planConfigsJson de la DB.`);
}

main().catch(e => { console.error(e); process.exit(1); });
