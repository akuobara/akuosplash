// Fix drift de fechaProximaGeneracion para TODOS los recurrentes activos.
// Para cada uno: encuentra el próximo ciclo futuro (basado en frec + diaSemanaPreferido)
// que NO tenga un pedido existente, y setea fechaProximaGeneracion a esa fecha.
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

// Réplica de calcularProximaFechaConDiaPreferido (UTC)
function calc(fechaActual, frecuenciaDias, diaSemanaPreferido) {
  const f = new Date(fechaActual);
  if (diaSemanaPreferido === null || diaSemanaPreferido === undefined || frecuenciaDias !== 7) {
    f.setDate(f.getDate() + frecuenciaDias);
    f.setUTCHours(0, 0, 0, 0);
    return f;
  }
  f.setDate(f.getDate() + 7);
  const diaActual = f.getUTCDay();
  const diff = (diaSemanaPreferido - diaActual + 7) % 7;
  f.setDate(f.getDate() + diff);
  f.setUTCHours(0, 0, 0, 0);
  return f;
}
const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

(async () => {
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  console.log("Hoy (UTC):", hoy.toISOString(), "\n");

  const recs = await db.execute(
    "SELECT pr.id, c.nombre as cliente, pr.frecuenciaDias, pr.diaSemanaPreferido, pr.fechaProximaGeneracion FROM PedidoRecurrente pr JOIN Cliente c ON c.id=pr.clienteId WHERE pr.activo=1"
  );

  for (const r of recs.rows) {
    // Último pedido del recurrente
    const last = await db.execute({ sql: "SELECT MAX(fechaSolicitada) as maxf FROM Pedido WHERE pedidoRecurrenteId=?", args: [r.id] });
    let base = last.rows[0].maxf ? new Date(last.rows[0].maxf) : new Date(r.fechaProximaGeneracion);
    base.setUTCHours(0, 0, 0, 0);

    // Avanzar al próximo ciclo, saltando fechas pasadas y fechas con pedido existente
    let candidate = calc(base, r.frecuenciaDias, r.diaSemanaPreferido);
    let safety = 0;
    while (safety < 20) {
      const existente = await db.execute({ sql: "SELECT id FROM Pedido WHERE pedidoRecurrenteId=? AND fechaSolicitada=?", args: [r.id, candidate.toISOString()] });
      if (candidate >= hoy && !existente.rows.length) break;
      candidate = calc(candidate, r.frecuenciaDias, r.diaSemanaPreferido);
      safety++;
    }

    const anterior = new Date(r.fechaProximaGeneracion).toISOString().slice(0, 10);
    const nuevo = candidate.toISOString();
    await db.execute({ sql: "UPDATE PedidoRecurrente SET fechaProximaGeneracion=? WHERE id=?", args: [nuevo, r.id] });
    const diaNombre = dias[candidate.getUTCDay()];
    console.log(`✓ ${r.cliente}: ${anterior} → ${nuevo.slice(0,10)} (${diaNombre}, frec=${r.frecuenciaDias}d)`);
  }
  console.log("\n✓ Todos los recurrentes alineados al próximo ciclo futuro sin pedido.");
})().catch(e => console.error("ERR", e.message, e.stack));
