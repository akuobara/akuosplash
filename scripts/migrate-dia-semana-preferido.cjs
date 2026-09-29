// Add diaSemanaPreferido column to PedidoRecurrente in Turso
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // Verificar columnas actuales
  console.log('=== Columnas actuales de PedidoRecurrente ===');
  const cols = await client.execute({ sql: "PRAGMA table_info(PedidoRecurrente)" });
  for (const c of cols.rows) console.log(`  ${c.name} | ${c.type}`);

  // Verificar si ya existe la columna
  const existe = cols.rows.some(c => c.name === 'diaSemanaPreferido');
  if (existe) {
    console.log('\nLa columna diaSemanaPreferido ya existe. No se hace nada.');
    return;
  }

  console.log('\n=== Agregando columna diaSemanaPreferido ===');
  await client.execute({
    sql: `ALTER TABLE PedidoRecurrente ADD COLUMN diaSemanaPreferido INTEGER`
  });
  console.log('✓ Columna agregada');

  // Verificar
  const cols2 = await client.execute({ sql: "PRAGMA table_info(PedidoRecurrente)" });
  console.log('\n=== Columnas después ===');
  for (const c of cols2.rows) console.log(`  ${c.name} | ${c.type}`);
}
main().catch(e => { console.error(e); process.exit(1); });
