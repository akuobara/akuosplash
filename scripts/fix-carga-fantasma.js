// Borrar la carga fantasma del dueño (asociada a la vuelta #44 borrada)
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // Buscar la carga fantasma: 25-sep 20:58:38 UTC, choferId=cmthcb85 (dueño), agua_planta
  const r = await client.execute({
    sql: `SELECT id, fecha, tipo, monto, pagadoPor, choferId, descripcion
          FROM Gasto
          WHERE fecha = '2026-09-25T20:58:38.691+00:00'
            AND choferId = 'cmthcb85x0001ld046apm4yuu'
            AND tipo = 'agua_planta'`,
  });
  console.log('=== Carga fantasma encontrada ===');
  for (const g of r.rows) console.log(g);

  if (r.rows.length === 0) {
    console.log('No encontrada por fecha exacta, buscando por rango cercano...');
    const r2 = await client.execute({
      sql: `SELECT id, fecha, tipo, monto, pagadoPor, choferId, descripcion
            FROM Gasto
            WHERE fecha >= '2026-09-25T20:58:00Z' AND fecha <= '2026-09-25T21:00:00Z'
              AND choferId = 'cmthcb85x0001ld046apm4yuu'
              AND tipo = 'agua_planta'`,
    });
    console.log('=== Búsqueda por rango ===');
    for (const g of r2.rows) console.log(g);
    if (r2.rows.length === 0) {
      console.log('No encontrada. Abortando.');
      return;
    }
    // Borrar la primera encontrada
    const id = r2.rows[0].id;
    console.log(`Borrando carga id=${id}`);
    await client.execute({ sql: `DELETE FROM Gasto WHERE id = ?`, args: [id] });
    console.log('✓ Borrada');
  } else {
    const id = r.rows[0].id;
    console.log(`Borrando carga id=${id}`);
    await client.execute({ sql: `DELETE FROM Gasto WHERE id = ?`, args: [id] });
    console.log('✓ Borrada');
  }

  // Verificación: contar cargas de la semana de nuevo
  console.log('\n=== Verificación post-borrado ===');
  const verif = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM Gasto
          WHERE tipo = 'agua_planta'
            AND fecha >= '2026-09-20T04:00:00Z' AND fecha < '2026-09-28T04:00:00Z'`,
  });
  console.log(`Cargas en la semana ahora: ${verif.rows[0].c} (debería ser 8)`);

  const verifHoy = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM Gasto
          WHERE tipo = 'agua_planta'
            AND fecha >= '2026-09-25T04:00:00Z' AND fecha < '2026-09-26T04:00:00Z'`,
  });
  console.log(`Cargas HOY ahora: ${verifHoy.rows[0].c} (debería ser 1)`);
}
main().catch(e => { console.error(e); process.exit(1); });
