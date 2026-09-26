// Inspeccionar vueltas en la BD Turso de producción para detectar duplicadas / inválidas
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) ¿Cuántos dueños hay? Para entender el contexto.
  const duenos = await client.execute("SELECT id, email, nombre FROM Usuario WHERE role='dueno' ORDER BY creadoEn ASC");
  console.log('=== Dueños ===');
  for (const r of duenos.rows) console.log(`  ${r.id} | ${r.email} | ${r.nombre}`);

  // 2) Listar TODAS las vueltas del mes actual (septiembre 2026) y comparar
  // Hoy es 2026-09-26 en hora CL (America/Santiago).
  // En UTC ya pasó el mediodía del 26, pero getRange('hoy') usa día local CL.
  // Para ver el período "hoy" y "semana" usamos hora CL.
  const periodos = [
    { nombre: 'hoy',   start: '2026-09-26T04:00:00Z', end: '2026-09-27T04:00:00Z' }, // 00:00 CL = 04:00 UTC
    { nombre: 'semana (lun-dom CL)', start: '2026-09-21T04:00:00Z', end: '2026-09-28T04:00:00Z' },
    { nombre: 'mes sept CL', start: '2026-09-01T04:00:00Z', end: '2026-10-01T04:00:00Z' },
  ];

  for (const p of periodos) {
    console.log(`\n=== Vueltas período: ${p.nombre} (${p.start} → ${p.end}) ===`);
    const res = await client.execute({
      sql: `SELECT v.id, v.numero, v.iniciadaEn, v.cerradaEn, v.activa, v.validadaManualmente,
              v.camionId, v.choferId, v.duenoId,
              (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) AS numEntregas,
              (SELECT COALESCE(SUM(e.litros),0) FROM Entrega e WHERE e.vueltaId = v.id) AS litros,
              (SELECT COALESCE(SUM(e.total),0) FROM Entrega e WHERE e.vueltaId = v.id) AS ventas
            FROM Vuelta v
            WHERE v.iniciadaEn >= ? AND v.iniciadaEn < ?
            ORDER BY v.iniciadaEn ASC`,
      args: [p.start, p.end],
    });
    console.log(`Total: ${res.rows.length}`);
    for (const r of res.rows) {
      console.log(`  #${r.numero} | id=${r.id.slice(0,8)} | ini=${r.iniciadaEn} | cer=${r.cerradaEn || '(abierta)'} | activa=${r.activa} | valMan=${r.validadaManualmente} | camionId=${r.camionId?.slice(0,8)} | choferId=${r.choferId?.slice(0,8)} | entregas=${r.numEntregas} | litros=${r.litros} | ventas=${r.ventas}`);
    }
  }

  // 3) Buscar vueltas sin entregas o duplicadas (mismo número / mismo camión en poco tiempo)
  console.log('\n=== Vueltas SIN entregas (candidatas a ser spurious) ===');
  const sinEntregas = await client.execute({
    sql: `SELECT v.id, v.numero, v.iniciadaEn, v.cerradaEn, v.activa, v.camionId, v.choferId
          FROM Vuelta v
          WHERE (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) = 0
          ORDER BY v.iniciadaEn DESC
          LIMIT 30`,
  });
  console.log(`Total vueltas sin entregas: ${sinEntregas.rows.length}`);
  for (const r of sinEntregas.rows) {
    console.log(`  #${r.numero} | id=${r.id.slice(0,8)} | ini=${r.iniciadaEn} | cer=${r.cerradaEn || '(abierta)'} | activa=${r.activa}`);
  }

  // 4) Buscar duplicados por número de vuelta (por dueño)
  console.log('\n=== Vueltas con mismo número por dueño (duplicados) ===');
  const dupes = await client.execute({
    sql: `SELECT duenoId, numero, COUNT(*) AS c
          FROM Vuelta
          GROUP BY duenoId, numero
          HAVING c > 1
          ORDER BY c DESC`,
  });
  for (const r of dupes.rows) console.log(`  duenoId=${r.duenoId.slice(0,8)} numero=${r.numero} count=${r.c}`);

  // 5) Últimas 15 vueltas a nivel global para ver el contexto completo
  console.log('\n=== Últimas 15 vueltas (global) ===');
  const ultimas = await client.execute({
    sql: `SELECT v.id, v.numero, v.iniciadaEn, v.cerradaEn, v.activa, v.duenoId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = v.id) AS numEntregas
          FROM Vuelta v
          ORDER BY v.iniciadaEn DESC
          LIMIT 15`,
  });
  for (const r of ultimas.rows) {
    console.log(`  #${r.numero} | id=${r.id.slice(0,8)} | ini=${r.iniciadaEn} | cer=${r.cerradaEn || '(abierta)'} | activa=${r.activa} | duenoId=${r.duenoId?.slice(0,8)} | entregas=${r.numEntregas}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
