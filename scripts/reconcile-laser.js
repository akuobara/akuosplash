// Reconciliación del láser:
// 1. El pedido "11-25 entregado" fue en realidad la entrega del 11-18 (drift lo creó con fecha 11-25).
//    Re-fecharlo a 11-18 (coincide con entrega.fecha). Sigue entregado con su entregaId.
// 2. Crear un pedido programado para 11-25 (próximo miércoles, visible en la app).
// 3. Confirmar fechaProximaGeneracion=12-02 (siguiente auto-gen del cron).
const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});

(async () => {
  // Datos del recurrente + cliente
  const rec = await db.execute(
    "SELECT pr.id, pr.duenoId, pr.litrosSolicitados, pr.metodoPagoPreferido, pr.nota, pr.asignacionTipo, pr.choferAsignadoId, pr.fechaProximaGeneracion, c.nombre, c.direccion, c.telefono, c.zona, c.lat, c.lng, c.id as clienteId FROM PedidoRecurrente pr JOIN Cliente c ON c.id=pr.clienteId WHERE lower(c.nombre)=lower('Laser')"
  );
  const r = rec.rows[0];
  console.log("recurrente duenoId:", r.duenoId, "| litros:", r.litrosSolicitados, "| asignacion:", r.asignacionTipo);

  // 1. Re-fechar el pedido 11-25 (entregado) → 11-18
  const upd = await db.execute({
    sql: "UPDATE Pedido SET fechaSolicitada='2026-11-18T00:00:00.000+00:00' WHERE id='cmwm6l3ih0007hs1znrg8d22y'",
    args: [],
  });
  console.log("✓ pedido cmwm6l3ih re-fechado 11-25 → 11-18 (rows affected:", upd.rowsAffected, ")");

  // 2. Crear pedido programado para 11-25 (próximo miércoles)
  const nuevo = await db.execute({
    sql: `INSERT INTO Pedido (id, clienteId, clienteNombre, clienteDireccion, clienteTelefono, clienteZona, clienteLat, clienteLng, litrosSolicitados, fechaSolicitada, metodoPagoPreferido, nota, estado, duenoId, asignacionTipo, choferAsignadoId, prioridadTipo, publicadoEn, creadoEn, pedidoRecurrenteId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-11-25T00:00:00.000+00:00', ?, ?, 'programado', ?, ?, ?, 'ninguna', ?, ?, ?)`,
    args: [
      "laser-prog-1125-" + Date.now(),
      r.clienteId, r.nombre, r.direccion, r.telefono, r.zona, r.lat, r.lng,
      r.litrosSolicitados,
      r.metodoPagoPreferido, r.nota,
      r.duenoId, r.asignacionTipo, r.choferAsignadoId,
      r.asignacionTipo === "publicado" ? new Date().toISOString() : null,
      new Date().toISOString(),
      r.id,
    ],
  });
  console.log("✓ pedido programado 11-25 creado (rows affected:", nuevo.rowsAffected, ")");

  // 3. Confirmar fechaProximaGeneracion=12-02
  const fpg = await db.execute({ sql: "SELECT fechaProximaGeneracion FROM PedidoRecurrente WHERE id=?", args: [r.id] });
  console.log("✓ fechaProximaGeneracion:", new Date(fpg.rows[0].fechaProximaGeneracion).toISOString().slice(0, 10));

  // Verificación final: pedidos láser
  const peds = await db.execute({
    sql: "SELECT fechaSolicitada, estado, entregaId FROM Pedido WHERE pedidoRecurrenteId=? ORDER BY fechaSolicitada DESC LIMIT 5",
    args: [r.id],
  });
  console.log("\n=== Estado final pedidos láser ===");
  for (const p of peds.rows) {
    console.log("  " + new Date(p.fechaSolicitada).toISOString().slice(0, 10) + " | " + p.estado + (p.entregaId ? " (entrega)" : ""));
  }
})().catch(e => console.error("ERR", e.message));
