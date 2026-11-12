const { createClient } = require('@libsql/client');

const url = 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA';

async function main() {
  const client = createClient({ url, authToken });

  // 1. Arreglar plan test: features = mismas que premium, precioMensual=0, precioSemanal=0, precioAnual=0
  const testFeatures = {
    dashboard: true, entregas: true, historial: true, gastos: true,
    vehiculo: false, clientes: true, recurrentes: true, equipo: false,
    liquidacion: false, docUpload: false, mpPropio: false, wasabil: false,
    perfil: true, subscripcion: true
  };

  await client.execute({
    sql: `UPDATE AkuoPlanConfig SET
            precioMensual = 0, precioSemanal = 0, precioAnual = 0,
            ciclosDisponibles = ?, features = ?, mpSplitMode = 'none', actualizadoEn = ?
          WHERE id = 'test'`,
    args: [JSON.stringify(["diario"]), JSON.stringify(testFeatures), new Date().toISOString()]
  });
  console.log('Plan test arreglado: solo precio diario $500, features = premium, ciclo = diario');

  // 2. Eliminar "anual" de todos los planes
  for (const id of ['gratis', 'premium', 'pro']) {
    const r = await client.execute({ sql: "SELECT ciclosDisponibles FROM AkuoPlanConfig WHERE id = ?", args: [id] });
    if (r.rows.length > 0) {
      let ciclos = [];
      try { ciclos = JSON.parse(r.rows[0].ciclosDisponibles || '[]'); } catch {}
      const sinAnual = ciclos.filter(c => c !== 'anual');
      if (sinAnual.length === 0) sinAnual.push('mensual');
      await client.execute({
        sql: "UPDATE AkuoPlanConfig SET ciclosDisponibles = ?, actualizadoEn = ? WHERE id = ?",
        args: [JSON.stringify(sinAnual), new Date().toISOString(), id]
      });
      console.log(`Plan ${id}: ciclos = ${JSON.stringify(sinAnual)}`);
    }
  }

  // 3. Verificar
  const r = await client.execute("SELECT id, precioMensual, precioDiario, ciclosDisponibles, features FROM AkuoPlanConfig ORDER BY orden");
  for (const row of r.rows) {
    const f = JSON.parse(row.features || '{}');
    const activeCount = Object.values(f).filter(v => v).length;
    console.log(`  ${row.id}: diario=${row.precioDiario}, mensual=${row.precioMensual}, ciclos=${row.ciclosDisponibles}, features activas=${activeCount}`);
  }

  await client.close();
}

main().catch(e => console.error(e));
