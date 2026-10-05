const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const cols = [
  "ALTER TABLE AkuoUsuario ADD COLUMN direccion TEXT",
  "ALTER TABLE AkuoUsuario ADD COLUMN comuna TEXT",
  "ALTER TABLE AkuoUsuario ADD COLUMN lat REAL",
  "ALTER TABLE AkuoUsuario ADD COLUMN lng REAL",
  "ALTER TABLE AkuoUsuario ADD COLUMN rut TEXT",
  "ALTER TABLE AkuoUsuario ADD COLUMN indicacionesAcceso TEXT",
  "ALTER TABLE AkuoUsuario ADD COLUMN requiereClientePresente BOOLEAN DEFAULT 1",
  "ALTER TABLE AkuoUsuario ADD COLUMN usoAgua TEXT DEFAULT 'consumo'",
];

async function main() {
  for (const sql of cols) {
    try { await client.execute(sql); console.log('✓', sql.slice(0, 60)); }
    catch (e) { console.log('—', e.message.slice(0, 80)); }
  }
}
main();
