// Setear diaSemanaPreferido para los recurrentes existentes de clientes específicos
// 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // Listar todos los recurrentes activos
  console.log('=== Recurrentes activos ===');
  const recs = await client.execute({
    sql: `SELECT r.id, r.frecuenciaDias, r.fechaProximaGeneracion, r.diaSemanaPreferido,
            c.id AS clienteId, c.nombre AS clienteNombre
          FROM PedidoRecurrente r
          JOIN Cliente c ON c.id = r.clienteId
          WHERE r.activo = 1
          ORDER BY c.nombre ASC`
  });
  for (const r of recs.rows) console.log(`  cliente="${r.clienteNombre}" | frec=${r.frecuenciaDias} | proxGen=${r.fechaProximaGeneracion} | diaSemPref=${r.diaSemanaPreferido === null ? 'null' : r.diaSemanaPreferido}`);

  // Mapear clientes a día de la semana preferido (según el user)
  // 0=domingo, 1=lunes, 2=martes, 3=miércoles, 4=jueves, 5=viernes, 6=sábado
  const diasPorCliente = {
    'milko': 5,         // viernes
    'almácigo': 4,      // jueves (Almácigos)
    'almacigo': 4,      // jueves (sin tilde, fallback)
    'violeta': 4,       // jueves
    'laser': 4,         // jueves (Laser)
    'lás': 4,           // jueves (Láser)
  };

  // Aplicar a cada recurrente cuya frecuencia sea 7 (semanal) y no tenga día seteado
  for (const r of recs.rows) {
    if (r.frecuenciaDias !== 7) continue;
    if (r.diaSemanaPreferido !== null && r.diaSemanaPreferido !== undefined) continue;

    const nombreLower = (r.clienteNombre || '').toLowerCase();
    let diaPreferido = null;
    for (const [key, dia] of Object.entries(diasPorCliente)) {
      if (nombreLower.includes(key)) {
        diaPreferido = dia;
        break;
      }
    }

    if (diaPreferido === null) {
      // Para clientes semanal sin match, usar el día de la fechaProximaGeneracion actual
      const fechaActual = new Date(r.fechaProximaGeneracion);
      diaPreferido = fechaActual.getDay();
      console.log(`\nCliente "${r.clienteNombre}" no tiene día específico — usando día actual de fechaProximaGeneracion: ${diaPreferido}`);
    } else {
      console.log(`\nSeteando "${r.clienteNombre}" → día ${diaPreferido}`);
    }

    // Actualizar
    await client.execute({
      sql: `UPDATE PedidoRecurrente SET diaSemanaPreferido = ? WHERE id = ?`,
      args: [diaPreferido, r.id]
    });
    console.log(`✓ Actualizado`);

    // Recalcular fechaProximaGeneracion al próximo día de la semana preferido
    // (a partir de hoy)
    const hoy = new Date();
    const diaHoy = hoy.getDay();
    let diasParaSumar = (diaPreferido - diaHoy + 7) % 7;
    if (diasParaSumar === 0) diasParaSumar = 7; // si hoy es el día preferido, ir al próximo (no hoy mismo)
    const nuevaFecha = new Date(hoy);
    nuevaFecha.setDate(hoy.getDate() + diasParaSumar);
    nuevaFecha.setUTCHours(0, 0, 0, 0);

    await client.execute({
      sql: `UPDATE PedidoRecurrente SET fechaProximaGeneracion = ? WHERE id = ?`,
      args: [nuevaFecha.toISOString(), r.id]
    });
    console.log(`✓ fechaProximaGeneracion recalculada a ${nuevaFecha.toISOString()} (día ${nuevaFecha.getDay()})`);
  }

  // Verificación final
  console.log('\n=== Estado final ===');
  const final = await client.execute({
    sql: `SELECT c.nombre AS cliente, r.frecuenciaDias, r.diaSemanaPreferido, r.fechaProximaGeneracion
          FROM PedidoRecurrente r
          JOIN Cliente c ON c.id = r.clienteId
          WHERE r.activo = 1 AND r.frecuenciaDias = 7
          ORDER BY c.nombre ASC`
  });
  for (const r of final.rows) {
    const diaSem = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const fecha = new Date(r.fechaProximaGeneracion);
    console.log(`  ${r.cliente} | diaPreferido=${r.diaSemanaPreferido} (${diaSem[r.diaSemanaPreferido]}) | próximaGen=${fecha.toISOString().slice(0,10)} (${diaSem[fecha.getDay()]})`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
