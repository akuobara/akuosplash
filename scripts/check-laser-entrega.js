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
  console.log("Hoy (UTC):", hoy.toISOString(), "\n");

  // Pedido 11-25 del láser + su entrega
  const p = await db.execute(
    "SELECT id, fechaSolicitada, estado, entregaId, creadoEn FROM Pedido WHERE pedidoRecurrenteId=(SELECT id FROM PedidoRecurrente WHERE clienteId=(SELECT id FROM Cliente WHERE lower(nombre)=lower('Laser'))) AND fechaSolicitada='2026-11-25T00:00:00.000+00:00'"
  );
  console.log("=== Pedido 11-25 láser ===");
  for (const x of p.rows) console.log(JSON.stringify(x));

  if (p.rows.length && p.rows[0].entregaId) {
    const e = await db.execute({ sql: "SELECT id, fecha, choferId, litros FROM Entrega WHERE id=?", args: [p.rows[0].entregaId] });
    console.log("\n=== Entrega vinculada ===");
    for (const x of e.rows) console.log("  fecha entrega:", new Date(x.fecha).toISOString(), "| choferId:", x.choferId, "| litros:", x.litros);
  }

  // Para comparar: la entrega del 11-11 (entregado pasado real)
  const p2 = await db.execute(
    "SELECT id, fechaSolicitada, entregaId FROM Pedido WHERE pedidoRecurrenteId=(SELECT id FROM PedidoRecurrente WHERE clienteId=(SELECT id FROM Cliente WHERE lower(nombre)=lower('Laser'))) AND fechaSolicitada='2026-11-11T00:00:00.000+00:00'"
  );
  if (p2.rows.length && p2.rows[0].entregaId) {
    const e2 = await db.execute({ sql: "SELECT fecha FROM Entrega WHERE id=?", args: [p2.rows[0].entregaId] });
    console.log("\n=== Entrega del 11-11 (comparación, entrega real pasada) ===");
    for (const x of e2.rows) console.log("  fecha entrega:", new Date(x.fecha).toISOString());
  }
})().catch(e => console.error("ERR", e.message));
