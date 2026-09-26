// Borrar vueltas fantasma con 0 entregas (cualquier período, cualquier dueño)
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // Listar todas las vueltas con 0 entregas
  const fantasma = await client.execute({
    sql: `SELECT v.id, v.numero, v.iniciadaEn, v.cerradaEn, v.activa, v.choferId, v.duenoId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) AS numEntregas
          FROM Vuelta v
          WHERE (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) = 0
          ORDER BY v.numero ASC`,
  });
  console.log(`=== Vueltas fantasma (0 entregas): ${fantasma.rows.length} ===`);
  for (const r of fantasma.rows) {
    console.log(`  #${r.numero} | id=${r.id.slice(0,12)} | ini=${r.iniciadaEn} | cer=${r.cerradaEn || '(abierta)'} | activa=${r.activa}`);
  }

  if (fantasma.rows.length === 0) {
    console.log('No hay vueltas fantasma restantes. Listo.');
    return;
  }

  // Borrarlas a todas
  for (const r of fantasma.rows) {
    console.log(`Borrando vuelta #${r.numero} (id=${r.id})...`);
    try {
      const del = await client.execute({ sql: `DELETE FROM Vuelta WHERE id = ?`, args: [r.id] });
      console.log(`  → borrada (rows: ${del?.meta?.changes ?? 'n/a'})`);
    } catch (e) {
      console.error(`  → ERROR borrando #${r.numero}:`, e.message);
    }
  }

  // Recuento final
  const restantes = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM Vuelta`,
  });
  console.log(`\nTotal vueltas restantes: ${restantes.rows[0].c}`);

  const sinEntregas = await client.execute({
    sql: `SELECT COUNT(*) AS c FROM Vuelta v
          WHERE (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) = 0`,
  });
  console.log(`Vueltas con 0 entregas restantes: ${sinEntregas.rows[0].c}`);
}
main().catch(e => { console.error(e); process.exit(1); });
