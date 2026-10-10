// Borrar el pedido duplicado de Yoni + buscar otros duplicados en la BD
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Buscar TODOS los pedidos duplicados (mismo cliente, creados con menos de 60s de diferencia, ambos pendientes)
  console.log('=== Buscar pedidos duplicados (mismo cliente, <60s, ambos pendientes o sin entregaId) ===');
  const dups = await client.execute({
    sql: `SELECT p1.id AS id1, p1.creadoEn AS creado1, p1.estado AS estado1, p1.entregaId AS entrega1,
            p2.id AS id2, p2.creadoEn AS creado2, p2.estado AS estado2, p2.entregaId AS entrega2,
            p1.clienteId, p1.clienteNombre
          FROM Pedido p1
          JOIN Pedido p2 ON p1.clienteId = p2.clienteId
            AND p1.id < p2.id
            AND ABS(strftime('%s', p1.creadoEn) - strftime('%s', p2.creadoEn)) < 60
          WHERE p1.duenoId = 'cmthcb85x0001ld046apm4yuu'
            AND p1.estado IN ('pendiente', 'programado')
          ORDER BY p1.creadoEn DESC
          LIMIT 50`,
  });
  console.log(`Duplicados encontrados: ${dups.rows.length}`);
  const aBorrar = [];
  for (const d of dups.rows) {
    const tieneEntrega1 = d.entrega1 !== null;
    const tieneEntrega2 = d.entrega2 !== null;
    console.log(`  cliente="${d.clienteNombre}" | p1=${d.id1.slice(0,8)} ${d.creado1} estado=${d.estado1} entrega=${tieneEntrega1} | p2=${d.id2.slice(0,8)} ${d.creado2} estado=${d.estado2} entrega=${tieneEntrega2}`);

    // Borrar el que NO tiene entregaId (o si ambos tienen, el que sigue pendiente)
    if (!tieneEntrega1 && tieneEntrega2) {
      aBorrar.push(d.id1);
      console.log(`    → borrar p1 (no tiene entrega)`);
    } else if (tieneEntrega1 && !tieneEntrega2) {
      aBorrar.push(d.id2);
      console.log(`    → borrar p2 (no tiene entrega)`);
    } else if (!tieneEntrega1 && !tieneEntrega2) {
      // Ambos sin entrega — borrar el más nuevo
      aBorrar.push(d.id2);
      console.log(`    → borrar p2 (ambos sin entrega, borrar el más nuevo)`);
    } else {
      // Ambos tienen entrega — no borrar (podría ser legit, ej: cliente pidió 2 veces)
      console.log(`    → no borrar (ambos tienen entrega)`);
    }
  }

  console.log(`\n=== Pedidos a borrar: ${aBorrar.length} ===`);
  for (const id of aBorrar) {
    // Verificar que no tenga entregaId antes de borrar
    const check = await client.execute({
      sql: `SELECT id, estado, clienteNombre, entregaId FROM Pedido WHERE id = ?`,
      args: [id],
    });
    if (check.rows.length === 0) {
      console.log(`  ${id.slice(0,12)} → ya no existe`);
      continue;
    }
    const p = check.rows[0];
    if (p.entregaId) {
      console.log(`  ${id.slice(0,12)} → SKIP (tiene entregaId, no borrar)`);
      continue;
    }
    console.log(`  Borrando ${id.slice(0,12)} | estado=${p.estado} | cliente="${p.clienteNombre}" | entregaId=null`);
    await client.execute({ sql: `DELETE FROM Pedido WHERE id = ?`, args: [id] });
    console.log(`    ✓ borrado`);
  }

  // Verificación final — listar pedidos pendientes activos
  console.log('\n=== Pedidos pendientes activos (post-borrado) ===');
  const final = await client.execute({
    sql: `SELECT id, creadoEn, estado, clienteNombre, entregaId FROM Pedido
          WHERE duenoId = 'cmthcb85x0001ld046apm4yuu'
            AND estado IN ('pendiente', 'programado')
          ORDER BY creadoEn DESC`,
  });
  for (const p of final.rows) {
    console.log(`  ${p.creadoEn} | estado=${p.estado} | cliente="${p.clienteNombre}" | entregaId=${p.entregaId ? 'vinculado' : 'NULL'}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
