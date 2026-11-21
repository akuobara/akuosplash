const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  const hoy = new Date();
  console.log("Hoy:", hoy.toISOString(), "\n");

  // 1. Escanear todos los recurrentes activos por drift de fechaProximaGeneracion
  const todos = await db.execute(
    "SELECT pr.id, c.nombre as cliente, pr.frecuenciaDias, pr.diaSemanaPreferido, pr.fechaProximaGeneracion, pr.activo FROM PedidoRecurrente pr JOIN Cliente c ON c.id=pr.clienteId WHERE pr.activo=1 ORDER BY pr.fechaProximaGeneracion"
  );
  console.log("=== Todos los recurrentes activos:", todos.rows.length, "===");
  for (const r of todos.rows) {
    const fpg = new Date(r.fechaProximaGeneracion);
    const diasAdelante = Math.round((fpg - hoy) / 86400000);
    const flag = diasAdelante > 10 ? " ⚠ DRIFT (>10 días adelantado)" : diasAdelante < -3 ? " ⚠ VENCIDO sin generar" : "";
    console.log(`  ${r.cliente}: frec=${r.frecuenciaDias} dia=${r.diaSemanaPreferido} proxGen=${fpg.toISOString().slice(0,10)} (${diasAdelante}d)${flag}`);
  }

  // 2. Fix láser: fechaProximaGeneracion → 2026-12-02 (próximo miércoles sin pedido; 11-25 ya tiene)
  console.log("\n=== Fix láser ===");
  const laser = await db.execute("SELECT id FROM PedidoRecurrente WHERE clienteId=(SELECT id FROM Cliente WHERE lower(nombre) LIKE lower('%laser%'))");
  if (!laser.rows.length) { console.log("No se encontró láser"); return; }
  const laserId = laser.rows[0].id;

  // Verificar qué miércoles ya tienen pedido (para elegir el correcto)
  const peds = await db.execute({ sql: "SELECT fechaSolicitada FROM Pedido WHERE pedidoRecurrenteId=? ORDER BY fechaSolicitada DESC LIMIT 5", args: [laserId] });
  console.log("Pedidos recientes láser:", peds.rows.map(p => new Date(p.fechaSolicitada).toISOString().slice(0,10)).join(", "));

  // Próximo miércoles sin pedido: 11-25 tiene, 12-02 no → setear 12-02
  await db.execute({ sql: "UPDATE PedidoRecurrente SET fechaProximaGeneracion=? WHERE id=?", args: ["2026-12-02T00:00:00.000Z", laserId] });
  const after = await db.execute({ sql: "SELECT fechaProximaGeneracion, frecuenciaDias, diaSemanaPreferido FROM PedidoRecurrente WHERE id=?", args: [laserId] });
  console.log("✓ láser fechaProximaGeneracion =", new Date(after.rows[0].fechaProximaGeneracion).toISOString(), "(12-02 miércoles, próximo sin pedido)");
})().catch(e => console.error("ERR", e.message));
