#!/usr/bin/env node
/**
 * Migración: agrega columnas nuevas de vehículo a AkuoUsuario
 *   - tipoCisterna
 *   - materialCisterna
 *   - tipoAgua
 *   - resolucionSanitariaUrl
 *
 * Idempotente: si ya existen, no falla.
 */
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const NUEVAS_COLUMNAS = [
  'ALTER TABLE AkuoUsuario ADD COLUMN tipoCisterna TEXT',
  'ALTER TABLE AkuoUsuario ADD COLUMN materialCisterna TEXT',
  'ALTER TABLE AkuoUsuario ADD COLUMN tipoAgua TEXT',
  'ALTER TABLE AkuoUsuario ADD COLUMN resolucionSanitariaUrl TEXT',
];

async function main() {
  for (const sql of NUEVAS_COLUMNAS) {
    try {
      await client.execute(sql);
      console.log(`✅ ${sql.replace('AkuoUsuario ADD COLUMN ', '→ agregada columna: ')}`);
    } catch (e) {
      if (String(e.message || '').includes('duplicate column') || String(e.message || '').includes('already exists')) {
        console.log(`⏭️  ya existe: ${sql.replace('ALTER TABLE AkuoUsuario ADD COLUMN ', '')}`);
      } else {
        console.error(`❌ Error en "${sql}": ${e.message}`);
      }
    }
  }
  console.log('\nMigración terminada.');
}

main().catch(e => { console.error(e); process.exit(1); });
