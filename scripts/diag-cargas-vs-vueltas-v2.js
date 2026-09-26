// Investigar discrepancia cargas de agua (tipo="agua_planta") vs vueltas
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) HOY (25-sep CL = 2026-09-25T04:00:00Z → 2026-09-26T04:00:00Z)
  console.log('=== Gastos de HOY (25-sep CL) ===');
  const hoyGastos = await client.execute({
    sql: `SELECT id, fecha, tipo, descripcion, monto, pagadoPor, choferId
          FROM Gasto
          WHERE fecha >= '2026-09-25T04:00:00Z' AND fecha < '2026-09-26T04:00:00Z'
          ORDER BY fecha ASC`,
  });
  console.log(`Total gastos HOY: ${hoyGastos.rows.length}`);
  for (const g of hoyGastos.rows) {
    console.log(`  ${g.fecha} | tipo="${g.tipo}" | desc="${g.descripcion || ''}" | monto=${g.monto} | pagadoPor=${g.pagadoPor} | choferId=${g.choferId ? g.choferId.slice(0,8) : 'null'}`);
  }

  const cargasHoy = hoyGastos.rows.filter(g => g.tipo === 'agua_planta');
  console.log(`\nCargas de agua HOY (agua_planta): ${cargasHoy.length}`);
  for (const g of cargasHoy) {
    console.log(`  ${g.fecha} | monto=${g.monto} | pagadoPor=${g.pagadoPor} | choferId=${g.choferId ? g.choferId.slice(0,8) : 'null'}`);
  }

  // 2) SEMANA (dom 20-sep a sáb 27-sep CL)
  console.log('\n=== Gastos de la SEMANA (dom 20-sep → sáb 27-sep CL) ===');
  const semanaGastos = await client.execute({
    sql: `SELECT id, fecha, tipo, descripcion, monto, pagadoPor, choferId
          FROM Gasto
          WHERE fecha >= '2026-09-20T04:00:00Z' AND fecha < '2026-09-28T04:00:00Z'
          ORDER BY fecha ASC`,
  });
  const cargasSemana = semanaGastos.rows.filter(g => g.tipo === 'agua_planta');
  console.log(`Total gastos semana: ${semanaGastos.rows.length}`);
  console.log(`Cargas de agua semana (agua_planta): ${cargasSemana.length}`);

  // Agrupar cargas por día CL
  console.log('\nCargas por día CL:');
  const porDia = {};
  for (const g of cargasSemana) {
    // Convertir fecha UTC a día CL: si fecha >= 04:00 UTC → ese día CL; si < 04:00 UTC → día anterior
    const d = new Date(g.fecha);
    const cl = new Date(d.getTime() - 4 * 3600 * 1000);
    const key = cl.toISOString().slice(0, 10);
    if (!porDia[key]) porDia[key] = [];
    porDia[key].push(g);
  }
  for (const [dia, arr] of Object.entries(porDia).sort()) {
    console.log(`  ${dia}: ${arr.length} carga(s)`);
    for (const g of arr) {
      console.log(`    ${g.fecha} | monto=${g.monto} | pagadoPor=${g.pagadoPor} | choferId=${g.choferId ? g.choferId.slice(0,8) : 'null'} | desc="${g.descripcion || ''}"`);
    }
  }

  // 3) Vueltas de la semana
  console.log('\n=== Vueltas de la SEMANA (dom 20-sep → sáb 27-sep CL) ===');
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

  // 4) Contar cargas también para hoy y comparar con vueltas iniciadas hoy
  console.log('\n=== Resumen ===');
  console.log(`Vueltas iniciadas hoy (25-sep CL): ${vueltas.rows.filter(v => v.iniciadaEn >= '2026-09-25T04:00:00Z' && v.iniciadaEn < '2026-09-26T04:00:00Z').length}`);
  console.log(`Cargas de agua registradas hoy (25-sep CL): ${cargasHoy.length}`);
  console.log(`Vueltas en la semana: ${vueltas.rows.length}`);
  console.log(`Cargas en la semana: ${cargasSemana.length}`);

  // 5) Buscar cargas por choferId en la semana
  console.log('\n=== Cargas por chofer en la semana ===');
  const porChofer = {};
  for (const g of cargasSemana) {
    const k = g.choferId ? g.choferId.slice(0,8) : 'null';
    if (!porChofer[k]) porChofer[k] = [];
    porChofer[k].push(g);
  }
  for (const [chofer, arr] of Object.entries(porChofer)) {
    console.log(`  choferId=${chofer}: ${arr.length} carga(s)`);
    for (const g of arr) {
      console.log(`    ${g.fecha} | monto=${g.monto} | desc="${g.descripcion || ''}"`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
