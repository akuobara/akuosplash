const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});
async function main() {
  // Vueltas activas
  const activas = await client.execute({
    sql: `SELECT id, numero, iniciadaEn, cerradaEn, activa, choferId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS numEntregas,
            (SELECT COALESCE(SUM(e.litros),0) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS litros
          FROM Vuelta WHERE activa = 1 ORDER BY iniciadaEn DESC`
  });
  console.log(`Vueltas ACTIVAS: ${activas.rows.length}`);
  for (const v of activas.rows) console.log(`  #${v.numero} | ini=${v.iniciadaEn} | entregas=${v.numEntregas} | litros=${v.litros}`);

  // Vueltas cerradas pero recientes (últimos 7 días)
  const recientes = await client.execute({
    sql: `SELECT id, numero, iniciadaEn, cerradaEn, activa, choferId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS numEntregas,
            (SELECT COALESCE(SUM(e.litros),0) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS litros
          FROM Vuelta WHERE activa = 0 AND cerradaEn >= '2026-09-27T04:00:00Z'
          ORDER BY numero DESC LIMIT 10`
  });
  console.log(`\nVueltas CERRADAS recientes (última semana): ${recientes.rows.length}`);
  for (const v of recientes.rows) console.log(`  #${v.numero} | ini=${v.iniciadaEn} | cer=${v.cerradaEn} | entregas=${v.numEntregas} | litros=${v.litros}`);

  // Vueltas NO cerradas (activa=1 pero iniciada hace más de 1 día)
  const colgadas = await client.execute({
    sql: `SELECT id, numero, iniciadaEn, activa,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS numEntregas,
            (SELECT COALESCE(SUM(e.litros),0) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS litros
          FROM Vuelta WHERE activa = 1 AND iniciadaEn < '2026-10-03T04:00:00Z'
          ORDER BY numero DESC`
  });
  console.log(`\nVueltas COLGADAS (activa=1, iniciada hace >1 día): ${colgadas.rows.length}`);
  for (const v of colgadas.rows) console.log(`  #${v.numero} | ini=${v.iniciadaEn} | entregas=${v.numEntregas} | litros=${v.litros}`);
}
main().catch(e => { console.error(e); process.exit(1); });
