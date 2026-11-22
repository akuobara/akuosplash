const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  // Clientes cuyo nombre contiene "laser"
  const c = await db.execute("SELECT id, nombre, zona FROM Cliente WHERE lower(nombre) LIKE lower('%laser%')");
  console.log("=== Clientes láser:", c.rows.length, "===");
  for (const r of c.rows) console.log(JSON.stringify(r));

  const recs = await db.execute(
    "SELECT pr.id, c.nombre as cliente, pr.frecuenciaDias, pr.diaSemanaPreferido, pr.fechaInicio, pr.fechaProximaGeneracion, pr.activo, pr.litrosSolicitados, pr.asignacionTipo, pr.choferAsignadoId FROM PedidoRecurrente pr JOIN Cliente c ON c.id = pr.clienteId WHERE lower(c.nombre) LIKE lower('%laser%')"
  );
  console.log("\n=== Recurrentes del láser:", recs.rows.length, "===");
  for (const r of recs.rows) console.log(JSON.stringify(r));

  for (const r of recs.rows) {
    const p = await db.execute({
      sql: "SELECT fechaSolicitada, estado, creadoEn FROM Pedido WHERE pedidoRecurrenteId = ? ORDER BY creadoEn DESC LIMIT 8",
      args: [r.id],
    });
    console.log(`\n--- Pedidos del recurrente ${String(r.id).slice(-8)} (${r.cliente}) ---`);
    for (const x of p.rows) console.log("  ", JSON.stringify(x));
  }
  console.log("\nHoy:", new Date().toISOString());
})().catch(e => console.error("ERR", e.message));
