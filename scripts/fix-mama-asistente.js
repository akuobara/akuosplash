// Fix Mama asistente: borrar los pedidos duplicados (30-sep y 1-oct) y generar uno para 2026-10-04
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  const clienteId = 'cmthi6esh0001l304uux76aqo'; // "Mama asistente"
  const recurrenteId = 'cmtitg2xc0001la04th2hphjy';

  // 1) Borrar los 2 pedidos duplicados programados (sin entrega asociada)
  console.log('=== Borrando pedidos duplicados ===');
  const aBorrar = await client.execute({
    sql: `SELECT id, fechaSolicitada FROM Pedido
          WHERE clienteId = ? AND pedidoRecurrenteId = ? AND entregaId IS NULL
            AND estado IN ('programado', 'pendiente')`,
    args: [clienteId, recurrenteId],
  });
  console.log(`Encontrados ${aBorrar.rows.length} pedidos a borrar:`);
  for (const p of aBorrar.rows) console.log(`  id=${p.id.slice(0,12)} | solicitado=${p.fechaSolicitada}`);

  for (const p of aBorrar.rows) {
    try {
      await client.execute({ sql: `DELETE FROM Pedido WHERE id = ?`, args: [p.id] });
      console.log(`  → borrado ${p.id.slice(0,12)}`);
    } catch (e) {
      console.error(`  → ERROR borrando ${p.id.slice(0,12)}:`, e.message);
    }
  }

  // 2) Calcular fecha del próximo pedido: última entrega + 10 días, ajustada a medianoche UTC
  const ultEntrega = await client.execute({
    sql: `SELECT fecha FROM Entrega WHERE clienteId = ? ORDER BY fecha DESC LIMIT 1`,
    args: [clienteId],
  });
  const ultimaFecha = new Date(ultEntrega.rows[0].fecha);
  console.log(`\nÚltima entrega: ${ultimaFecha.toISOString()}`);
  const proximaFecha = new Date(ultimaFecha);
  proximaFecha.setDate(proximaFecha.getDate() + 10);
  proximaFecha.setUTCHours(0, 0, 0, 0);
  console.log(`Próxima fecha programada (ultima+10, medianoche UTC): ${proximaFecha.toISOString()}`);

  // 3) Recuperar datos del recurrente y cliente para crear el nuevo pedido
  const rec = await client.execute({
    sql: `SELECT r.id, r.litrosSolicitados, r.metodoPagoPreferido, r.nota, r.asignacionTipo, r.choferAsignadoId, r.duenoId,
                 c.nombre, c.direccion, c.telefono, c.zona, c.lat, c.lng, c.indicacionesAcceso, c.choferPreferidoId
          FROM PedidoRecurrente r
          JOIN Cliente c ON c.id = r.clienteId
          WHERE r.id = ?`,
    args: [recurrenteId],
  });
  const r = rec.rows[0];
  console.log(`\nDatos recurrente:`, { litros: r.litrosSolicitados, metodo: r.metodoPagoPreferido, asignTipo: r.asignacionTipo, choferAsig: r.choferAsignadoId, dueno: r.duenoId });

  // 4) Crear el nuevo pedido programado para la fecha correcta
  // Usar el chofer asignado al recurrente, o el choferPreferido del cliente, o el dueño
  const choferId = r.choferAsignadoId || r.choferPreferidoId || r.duenoId;
  const ahora = new Date();
  const nuevoId = 'fix-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  await client.execute({
    sql: `INSERT INTO Pedido (id, creadoEn, clienteNombre, clienteDireccion, clienteTelefono, clienteZona,
                              clienteLat, clienteLng, clienteId, indicacionesAcceso,
                              litrosSolicitados, fechaSolicitada, franjaHoraria, metodoPagoPreferido, nota,
                              estado, entregaId, asignacionTipo, choferAsignadoId, tomadoPorChoferId,
                              prioridadChoferId, prioridadTipo, publicadoEn, choferId, duenoId, vueltaId,
                              pedidoRecurrenteId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'programado', NULL, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, ?)`,
    args: [
      nuevoId, ahora.toISOString(), r.nombre, r.direccion, r.telefono, r.zona,
      r.lat, r.lng, clienteId, r.indicacionesAcceso,
      r.litrosSolicitados, proximaFecha.toISOString(),
      r.metodoPagoPreferido, r.nota,
      r.asignacionTipo, r.choferAsignadoId,
      r.choferPreferidoId, r.choferPreferidoId ? 'permanente' : 'ninguna',
      r.asignacionTipo === 'publicado' ? ahora.toISOString() : null,
      choferId, r.duenoId,
      recurrenteId,
    ],
  });
  console.log(`\n✓ Nuevo pedido creado: id=${nuevoId} | fechaSolicitada=${proximaFecha.toISOString()}`);

  // 5) Actualizar fechaProximaGeneracion del recurrente a la fecha del nuevo pedido
  await client.execute({
    sql: `UPDATE PedidoRecurrente SET fechaProximaGeneracion = ? WHERE id = ?`,
    args: [proximaFecha.toISOString(), recurrenteId],
  });
  console.log(`✓ fechaProximaGeneracion actualizada a ${proximaFecha.toISOString()}`);

  // 6) Verificación final
  console.log('\n=== Verificación final ===');
  const finalPedidos = await client.execute({
    sql: `SELECT id, creadoEn, fechaSolicitada, estado FROM Pedido
          WHERE clienteId = ? ORDER BY fechaSolicitada ASC`,
    args: [clienteId],
  });
  for (const p of finalPedidos.rows) {
    console.log(`  ${p.fechaSolicitada} | estado=${p.estado} | creado=${p.creadoEn}`);
  }
  const finalRec = await client.execute({
    sql: `SELECT frecuenciaDias, fechaInicio, fechaProximaGeneracion, activo FROM PedidoRecurrente WHERE id = ?`,
    args: [recurrenteId],
  });
  console.log('Estado recurrente:', finalRec.rows[0]);
}
main().catch(e => { console.error(e); process.exit(1); });
