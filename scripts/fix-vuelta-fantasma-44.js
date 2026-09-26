// Borrar la vuelta fantasma #44 (id cmuhg0xw...) que el dueño abrió por error
// y que tiene 0 entregas. También parchear el resumen para que vueltas con 0 entregas no cuenten.
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const VUELTA_ID = 'cmuhg0xwxxxxxxxxxxxxxxxx'; // prefix only — need full id

  // 1) Recuperar el id completo de la vuelta #44
  const r = await client.execute({
    sql: `SELECT id, numero, iniciadaEn, cerradaEn, activa, choferId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS numEntregas
          FROM Vuelta WHERE numero = 44 AND duenoId = 'cmthcb85x0001ld046apm4yuu'`,
  });
  if (r.rows.length === 0) {
    console.log('No encontrada la vuelta #44.');
    return;
  }
  const row = r.rows[0];
  console.log('Encontrada:', {
    id: row.id,
    numero: row.numero,
    iniciadaEn: row.iniciadaEn,
    cerradaEn: row.cerradaEn,
    activa: row.activa,
    choferId: row.choferId,
    numEntregas: row.numEntregas,
  });

  // 2) Verificar que tenga 0 entregas (safety check)
  if (row.numEntregas > 0) {
    console.error(`ABORT: la vuelta #44 tiene ${row.numEntregas} entregas, NO se debe borrar automáticamente.`);
    return;
  }
  if (row.cerradaEn && String(row.cerradaEn).length > 0) {
    console.log('Nota: la vuelta ya estaba cerrada.');
  }

  // 3) Borrar la vuelta (no hay FK que la referencie desde Entrega porque no tiene entregas)
  let del;
  try {
    del = await client.execute({
      sql: `DELETE FROM Vuelta WHERE id = ?`,
      args: [row.id],
    });
  } catch (e) {
    console.error('Error al borrar:', e.message);
    throw e;
  }
  console.log('Resultado del DELETE:', JSON.stringify(del, null, 2));

  // 4) Verificar
  const check = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM Vuelta WHERE id = ?`,
    args: [row.id],
  });
  console.log('Check post-borrado (debe ser 0):', check.rows[0].c);

  // 5) Recuento de vueltas de la semana (sept 20-27 CL = sept 20 04:00 UTC → sept 28 04:00 UTC)
  const recuento = await client.execute({
    sql: `SELECT v.id, v.numero, v.iniciadaEn, v.cerradaEn, v.activa,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) AS numEntregas,
            (SELECT COALESCE(SUM(e.litros),0) FROM Entrega e WHERE e.vueltaId = v.id) AS litros
          FROM Vuelta v
          WHERE v.iniciadaEn >= '2026-09-20T04:00:00Z' AND v.iniciadaEn < '2026-09-28T04:00:00Z'
          ORDER BY v.numero ASC`,
  });
  console.log(`\n=== Recuento semana (post-borrado): ${recuento.rows.length} vueltas ===`);
  for (const v of recuento.rows) {
    console.log(`  #${v.numero} | ini=${v.iniciadaEn} | activa=${v.activa} | entregas=${v.numEntregas} | litros=${v.litros}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
