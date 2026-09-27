// Borrar el pedido espurio "Reagendado automáticamente" de Diana Ibañez
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  console.log('=== Buscar pedido espurio "Reagendado automáticamente" ===');
  const r = await client.execute({
    sql: `SELECT id, creadoEn, clienteId, clienteNombre, litrosSolicitados, estado, nota
          FROM Pedido
          WHERE clienteId = 'cmtyp779u0001l204c7qdd94d'
            AND nota LIKE 'Reagendado autom%'
          ORDER BY creadoEn DESC`,
  });
  for (const p of r.rows) console.log(`  id=${p.id} | creado=${p.creadoEn} | cliente="${p.clienteNombre}" | litros=${p.litrosSolicitados} | estado=${p.estado}`);

  if (r.rows.length === 0) {
    console.log('No se encontró pedido espurio.');
    return;
  }

  // Borrarlo
  for (const p of r.rows) {
    console.log(`\nBorrando pedido ${p.id}...`);
    await client.execute({ sql: `DELETE FROM Pedido WHERE id = ?`, args: [p.id] });
    console.log(`✓ Borrado.`);
  }

  // También limpiar la nota del pedido original (que dice "Resto reagendado")
  console.log('\n=== Limpiar nota del pedido original ===');
  const orig = await client.execute({
    sql: `SELECT id, nota, litrosSolicitados, estado FROM Pedido WHERE clienteId = 'cmtyp779u0001l204c7qdd94d' AND nota LIKE 'Entrega parcial%'`,
  });
  for (const p of orig.rows) console.log(`  Original: id=${p.id} | estado=${p.estado} | nota="${p.nota}"`);

  // Actualizar nota para borrar la mención del reagendado
  for (const p of orig.rows) {
    const nuevaNota = p.nota?.replace(/Resto reagendado en nuevo pedido\.?/g, '').trim() || null;
    await client.execute({ sql: `UPDATE Pedido SET nota = ? WHERE id = ?`, args: [nuevaNota, p.id] });
    console.log(`  → nota actualizada a: "${nuevaNota || '(null)'}"`);
  }

  // Verificación final
  console.log('\n=== Estado final ===');
  const fin = await client.execute({
    sql: `SELECT id, creadoEn, clienteNombre, litrosSolicitados, estado, nota FROM Pedido WHERE clienteId = 'cmtyp779u0001l204c7qdd94d' ORDER BY creadoEn ASC`,
  });
  for (const p of fin.rows) console.log(`  ${p.creadoEn} | nombre="${p.clienteNombre}" | litros=${p.litrosSolicitados} | estado=${p.estado} | nota="${p.nota || ''}"`);
}
main().catch(e => { console.error(e); process.exit(1); });
