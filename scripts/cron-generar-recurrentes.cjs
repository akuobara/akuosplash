// Cron job: genera pedidos recurrentes vencidos
// Se ejecuta automáticamente en la API de pedidos (GET /api/pedidos)
// Pero también puede llamarse manualmente o por un cron externo

const { createClient } = require('@libsql/client');

async function generarRecurrentes() {
  const client = createClient({
    url: process.env.DATABASE_URL || 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const ahora = new Date();
  
  // Buscar recurrentes vencidos
  const recurrentes = await client.execute({
    sql: 'SELECT * FROM PedidoRecurrente WHERE activo = 1 AND fechaProximaGeneracion <= ?',
    args: [ahora.toISOString()]
  });

  let generados = 0;
  for (const rec of recurrentes.rows) {
    // Verificar que no exista ya un pedido para este recurrente hoy
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString();
    const existente = await client.execute({
      sql: 'SELECT id FROM Pedido WHERE pedidoRecurrenteId = ? AND creadoEn >= ?',
      args: [rec.id, inicioHoy]
    });
    if (existente.rows.length > 0) continue;

    // Obtener cliente
    const cliente = await client.execute({
      sql: 'SELECT nombre, direccion, telefono, zona, lat, lng FROM Cliente WHERE id = ?',
      args: [rec.clienteId]
    });
    const c = cliente.rows[0];
    if (!c) continue;

    // Crear pedido
    const id = 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    await client.execute({
      sql: `INSERT INTO Pedido (id, creadoEn, clienteNombre, clienteDireccion, clienteTelefono, clienteZona, clienteLat, clienteLng, clienteId, litrosSolicitados, fechaSolicitada, metodoPagoPreferido, estado, duenoId, asignacionTipo, choferAsignadoId, prioridadTipo, publicadoEn, pedidoRecurrenteId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, ahora.toISOString(), c.nombre, c.direccion, c.telefono, c.zona, c.lat, c.lng,
        rec.clienteId, rec.litrosSolicitados, rec.fechaProximaGeneracion, rec.metodoPagoPreferido,
        'pendiente', rec.duenoId, rec.asignacionTipo, rec.choferAsignadoId,
        'ninguna', rec.asignacionTipo === 'publicado' ? ahora.toISOString() : null, rec.id
      ]
    });

    // Actualizar próxima generación
    const proxima = new Date(rec.fechaProximaGeneracion);
    proxima.setDate(proxima.getDate() + rec.frecuenciaDias);
    await client.execute({
      sql: 'UPDATE PedidoRecurrente SET fechaProximaGeneracion = ? WHERE id = ?',
      args: [proxima.toISOString(), rec.id]
    });
    generados++;
  }

  console.log(`Recurrentes generados: ${generados}`);
  return generados;
}

module.exports = { generarRecurrentes };
