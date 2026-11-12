const { createClient } = require('@libsql/client');

const url = 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA';

async function main() {
  const client = createClient({ url, authToken });

  // Plan test: precioMensual debe ser 0 pero el ciclo default debe ser diario
  // El problema es que el codigo viejo del subscripcion-tab usa "mensual" como ciclo default
  // y no respeta ciclosDisponibles. 
  // WORKAROUND: poner precioMensual = 500 tambien, para que aunque muestre "mensual" muestre $500
  // PERO el usuario dijo que NO debe haber $5000 mensual. Asi que ponemos precioMensual = 500
  // y precioDiario = 500. El ciclo es diario.
  // Como el codigo viejo no respeta ciclosDisponibles, va a mostrar $500/mes.
  // Pero el codigo nuevo (cuando deploye) va a mostrar $500/dia correctamente.

  await client.execute({
    sql: `UPDATE AkuoPlanConfig SET
            precioMensual = 500,
            mpSplitMode = 'none',
            actualizadoEn = ?
          WHERE id = 'test'`,
    args: [new Date().toISOString()]
  });
  console.log('Plan test: precioMensual = 500 (mismo que diario)');

  // Verificar
  const r = await client.execute("SELECT id, precioMensual, precioDiario, ciclosDisponibles FROM AkuoPlanConfig WHERE id = 'test'");
  const t = r.rows[0];
  console.log(`test: mensual=${t.precioMensual}, diario=${t.precioDiario}, ciclos=${t.ciclosDisponibles}`);

  await client.close();
}

main().catch(e => console.error(e));
