// Investigar la discrepancia entre cargas de agua registradas y vueltas
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Inspeccionar schema de Gasto para ver los tipos posibles
  console.log('=== Schema Gasto ===');
  const schema = await client.execute({ sql: "PRAGMA table_info(Gasto)" });
  for (const r of schema.rows) console.log(`  ${r.name} | ${r.type} | notnull=${r.notnull} | default=${r.dflt}`);

  // 2) Ver todos los tipos de gasto distintos que existen en la BD
  console.log('\n=== Tipos de gasto distintos en la BD ===');
  const tipos = await client.execute({
    sql: `SELECT tipo, COUNT(*) AS c FROM Gasto GROUP BY tipo ORDER BY c DESC`,
  });
  for (const r of tipos.rows) console.log(`  "${r.tipo}" | ${r.c} ocurrencias`);

  // 3) Para hoy (25-sep CL = 2026-09-25T04:00:00Z → 2026-09-26T04:00:00Z): listar todos los gastos
  console.log('\n=== Gastos de HOY (25-sep CL) ===');
  const hoyGastos = await client.execute({
    sql: `SELECT id, fecha, tipo, descripcion, monto, pagadoPor, choferId, duenoId, vueltaId
          FROM Gasto
          WHERE fecha >= '2026-09-25T04:00:00Z' AND fecha < '2026-09-26T04:00:00Z'
          ORDER BY fecha ASC`,
  });
  console.log(`Total: ${hoyGastos.rows.length}`);
  for (const g of hoyGastos.rows) {
    console.log(`  ${g.fecha} | tipo="${g.tipo}" | desc="${g.descripcion || ''}" | monto=${g.monto} | pagadoPor=${g.pagadoPor} | choferId=${g.choferId ? g.choferId.slice(0,8) : 'null'} | vueltaId=${g.vueltaId ? g.vueltaId.slice(0,8) : 'null'}`);
  }

  // 4) Para la semana (dom 20-sep CL a sáb 27-sep CL = 2026-09-20T04:00:00Z → 2026-09-28T04:00:00Z):
  console.log('\n=== Gastos de la SEMANA (dom 20-sep a sáb 27-sep CL) ===');
  const semanaGastos = await client.execute({
    sql: `SELECT id, fecha, tipo, descripcion, monto, pagadoPor, choferId, vueltaId
          FROM Gasto
          WHERE fecha >= '2026-09-20T04:00:00Z' AND fecha < '2026-09-28T04:00:00Z'
          ORDER BY fecha ASC`,
  });
  console.log(`Total semana: ${semanaGastos.rows.length}`);
  // Contar cargas de agua (tipo LIKE '%carga%' OR LIKE '%agua%')
  const cargasSemana = semanaGastos.rows.filter(g => {
    const t = String(g.tipo).toLowerCase();
    return t.includes('carga') || t.includes('agua');
  });
  console.log(`Cargas de agua en la semana: ${cargasSemana.length}`);
  for (const g of cargasSemana) {
    console.log(`  ${g.fecha} | tipo="${g.tipo}" | desc="${g.descripcion || ''}" | monto=${g.monto} | vueltaId=${g.vueltaId ? g.vueltaId.slice(0,8) : 'null'}`);
  }

  // 5) Contar vueltas de la semana (mismo rango)
  console.log('\n=== Vueltas de la SEMANA ===');
  const vueltas = await client.execute({
    sql: `SELECT id, numero, iniciadaEn, cerradaEn, activa, choferId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS numEntregas
          FROM Vuelta
          WHERE iniciadaEn >= '2026-09-20T04:00:00Z' AND iniciadaEn < '2026-09-28T04:00:00Z'
          ORDER BY numero ASC`,
  });
  console.log(`Total vueltas semana: ${vueltas.rows.length}`);
  for (const v of vueltas.rows) {
    console.log(`  #${v.numero} | ini=${v.iniciadaEn} | cer=${v.cerradaEn || '(abierta)'} | activa=${v.activa} | choferId=${v.choferId ? v.choferId.slice(0,8) : 'null'} | entregas=${v.numEntregas}`);
  }

  // 6) Cruzar vueltas con cargas: ¿qué vueltas tienen una carga asociada?
  console.log('\n=== Cruzar vueltas → cargas de agua ===');
  for (const v of vueltas.rows) {
    const cargas = semanaGastos.rows.filter(g => {
      const t = String(g.tipo).toLowerCase();
      return (t.includes('carga') || t.includes('agua')) && g.vueltaId === v.id;
    });
    console.log(`  Vuelta #${v.numero} (id=${v.id.slice(0,8)}) → ${cargas.length} carga(s)`);
  }

  // 7) ¿Cuántas cargas de agua NO tienen vueltaId? (Esto explicaría "una carga de más" en otro lado)
  const cargasSinVuelta = cargasSemana.filter(g => !g.vueltaId);
  console.log(`\nCargas de agua SIN vueltaId asociada: ${cargasSinVuelta.length}`);
  for (const g of cargasSinVuelta) {
    console.log(`  ${g.fecha} | tipo="${g.tipo}" | desc="${g.descripcion || ''}"`);
  }

  // 8) ¿Cargas de HOY con y sin vuelta?
  console.log('\n=== Cargas de agua de HOY ===');
  const cargasHoy = hoyGastos.rows.filter(g => {
    const t = String(g.tipo).toLowerCase();
    return t.includes('carga') || t.includes('agua');
  });
  console.log(`Total cargas HOY: ${cargasHoy.length}`);
  for (const g of cargasHoy) {
    console.log(`  ${g.fecha} | tipo="${g.tipo}" | desc="${g.descripcion || ''}" | vueltaId=${g.vueltaId ? g.vueltaId.slice(0,8) : 'null'}`);
  }

  // 9) Hoy: contar vueltas iniciadas hoy
  console.log('\n=== Vueltas iniciadas HOY (25-sep CL) ===');
  const vueltasHoy = await client.execute({
    sql: `SELECT id, numero, iniciadaEn, cerradaEn, activa, choferId,
            (SELECT COUNT(*) FROM Entrega e WHERE e.vueltaId = Vuelta.id) AS numEntregas
          FROM Vuelta
          WHERE iniciadaEn >= '2026-09-25T04:00:00Z' AND iniciadaEn < '2026-09-26T04:00:00Z'
          ORDER BY numero ASC`,
  });
  console.log(`Total vueltas HOY: ${vueltasHoy.rows.length}`);
  for (const v of vueltasHoy.rows) {
    console.log(`  #${v.numero} | ini=${v.iniciadaEn} | cer=${v.cerradaEn || '(abierta)'} | activa=${v.activa} | choferId=${v.choferId ? v.choferId.slice(0,8) : 'null'} | entregas=${v.numEntregas}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
