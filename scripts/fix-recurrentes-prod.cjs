// Reparación de pedidos recurrentes en producción (Aljibe/Turso)
const { createClient } = require('@libsql/client');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

function calcularProxima(fechaActual, frecuenciaDias, diaSemanaPreferido) {
  if (diaSemanaPreferido === null || diaSemanaPreferido === undefined || frecuenciaDias !== 7) {
    const p = new Date(fechaActual);
    p.setDate(p.getDate() + frecuenciaDias);
    p.setUTCHours(0, 0, 0, 0);
    return p;
  }
  const p = new Date(fechaActual);
  p.setDate(p.getDate() + 7);
  const diaActual = p.getDay();
  const diff = (diaSemanaPreferido - diaActual + 7) % 7;
  p.setDate(p.getDate() + diff);
  p.setUTCHours(0, 0, 0, 0);
  return p;
}

async function main() {
  const ahora = new Date();
  const en7dias = new Date(ahora);
  en7dias.setDate(en7dias.getDate() + 7);

  console.log('=== REPARACIÓN DE RECURRENTES ===');
  console.log('Ahora:', ahora.toISOString());
  console.log('');

  // Listar recurrentes activos
  const recurrentes = await client.execute({
    sql: `SELECT pr.id, pr.activo, pr.frecuenciaDias, pr.diaSemanaPreferido,
                 pr.fechaInicio, pr.fechaProximaGeneracion, pr.litrosSolicitados,
                 pr.metodoPagoPreferido, pr.nota, pr.duenoId, pr.asignacionTipo,
                 pr.choferAsignadoId,
                 pr.clienteId, c.nombre as clienteNombre, c.direccion as clienteDireccion,
                 c.telefono as clienteTelefono, c.zona as clienteZona,
                 c.lat as clienteLat, c.lng as clienteLng
          FROM PedidoRecurrente pr
          JOIN Cliente c ON c.id = pr.clienteId
          WHERE pr.activo = 1
          ORDER BY c.nombre ASC`,
  });

  console.log(`Recurrentes activos: ${recurrentes.rows.length}\n`);

  let reparados = 0;
  let generados = 0;

  for (const rec of recurrentes.rows) {
    const fechaProxima = new Date(rec.fechaProximaGeneracion);
    const diasHastaProxima = Math.ceil((fechaProxima.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    // Buscar último pedido
    const ultimo = await client.execute({
      sql: `SELECT id, fechaSolicitada, estado FROM Pedido WHERE pedidoRecurrenteId = ? ORDER BY fechaSolicitada DESC LIMIT 1`,
      args: [rec.id],
    });
    const ult = ultimo.rows[0];

    console.log(`[${diasHastaProxima > 7 ? 'ADELANTADO' : diasHastaProxima < 0 ? 'VENCIDO' : 'OK'}] ${rec.clienteNombre}`);
    console.log(`  fechaProxima: ${fechaProxima.toISOString()} (${diasHastaProxima}d)`);
    if (ult) console.log(`  último pedido: ${new Date(ult.fechaSolicitada).toISOString()} (${ult.estado})`);

    // PASO 1: Reparar fechaProxima si está adelantada
    if (diasHastaProxima > 7) {
      // Calcular fecha correcta desde el último pedido
      let fechaBase;
      if (ult && ult.fechaSolicitada) {
        fechaBase = new Date(ult.fechaSolicitada);
      } else {
        fechaBase = new Date(rec.fechaInicio);
      }
      let nuevaFecha = calcularProxima(fechaBase, rec.frecuenciaDias, rec.diaSemanaPreferido);
      // Si ya pasó, avanzar
      while (nuevaFecha < ahora) {
        nuevaFecha = calcularProxima(nuevaFecha, rec.frecuenciaDias, rec.diaSemanaPreferido);
      }
      console.log(`  → REPARANDO: ${fechaProxima.toISOString()} → ${nuevaFecha.toISOString()}`);
      await client.execute({
        sql: `UPDATE PedidoRecurrente SET fechaProximaGeneracion = ? WHERE id = ?`,
        args: [nuevaFecha.toISOString(), rec.id],
      });
      reparados++;
      // Usar la fecha reparada para el siguiente paso
      rec.fechaProximaGeneracion = nuevaFecha.toISOString();
    }

    // PASO 2: Generar pedido si fechaProxima <= en7dias
    const fechaProximaFinal = new Date(rec.fechaProximaGeneracion);
    if (fechaProximaFinal <= en7dias) {
      // Check si ya existe pedido para esta fecha
      const existente = await client.execute({
        sql: `SELECT id FROM Pedido WHERE pedidoRecurrenteId = ? AND fechaSolicitada = ?`,
        args: [rec.id, fechaProximaFinal.toISOString()],
      });

      if (existente.rows.length > 0) {
        console.log(`  → Ya existe pedido para ${fechaProximaFinal.toISOString()}, avanzando`);
      } else {
        // Generar pedido
        const pedidoId = 'rec-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
        const estadoPedido = fechaProximaFinal > ahora ? 'programado' : 'pendiente';

        await client.execute({
          sql: `INSERT INTO Pedido (id, creadoEn, clienteNombre, clienteDireccion, clienteTelefono,
                clienteZona, clienteLat, clienteLng, clienteId, litrosSolicitados,
                fechaSolicitada, metodoPagoPreferido, nota, estado, duenoId,
                asignacionTipo, choferAsignadoId, prioridadTipo, publicadoEn, pedidoRecurrenteId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            pedidoId,
            ahora.toISOString(),
            rec.clienteNombre,
            rec.clienteDireccion,
            rec.clienteTelefono,
            rec.clienteZona,
            rec.clienteLat,
            rec.clienteLng,
            rec.clienteId,
            rec.litrosSolicitados,
            fechaProximaFinal.toISOString(),
            rec.metodoPagoPreferido,
            rec.nota,
            estadoPedido,
            rec.duenoId,
            rec.asignacionTipo,
            rec.choferAsignadoId,
            'ninguna',
            rec.asignacionTipo === 'publicado' ? ahora.toISOString() : null,
            rec.id,
          ],
        });

        console.log(`  → PEDIDO GENERADO: ${estadoPedido} para ${fechaProximaFinal.toISOString()} (${rec.litrosSolicitados} L)`);
        generados++;
      }

      // Avanzar fechaProximaGeneracion
      const proxima = calcularProxima(fechaProximaFinal, rec.frecuenciaDias, rec.diaSemanaPreferido);
      await client.execute({
        sql: `UPDATE PedidoRecurrente SET fechaProximaGeneracion = ? WHERE id = ?`,
        args: [proxima.toISOString(), rec.id],
      });
      console.log(`  → Próxima fecha: ${proxima.toISOString()}`);
    }

    console.log('');
  }

  console.log('=== RESUMEN ===');
  console.log(`Recurrentes revisados: ${recurrentes.rows.length}`);
  console.log(`Fechas reparadas: ${reparados}`);
  console.log(`Pedidos generados: ${generados}`);

  process.exit(0);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
