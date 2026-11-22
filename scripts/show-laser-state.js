const fs = require("fs");
const { createClient } = require("@libsql/client");
const SRC = fs.readFileSync("/home/z/my-project/scripts/create-render-service.py", "utf8");
const grab = (re) => { const m = SRC.match(re); return m ? m[1] : null; };
const db = createClient({
  url: grab(/"key":\s*"DATABASE_URL"[^}]*?"value":\s*"([^"]+)"/),
  authToken: grab(/"key":\s*"DATABASE_AUTH_TOKEN"[^}]*?"value":\s*"([^"]+)"/),
});
const dias = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

(async () => {
  const r = await db.execute("SELECT id, fechaProximaGeneracion, frecuenciaDias, diaSemanaPreferido, activo, asignacionTipo FROM PedidoRecurrente WHERE clienteId=(SELECT id FROM Cliente WHERE lower(nombre)=lower('Laser'))");
  if (!r.rows.length) { console.log("No hay recurrente láser"); return; }
  const rec = r.rows[0];
  console.log("=== RECURRENTE láser ===");
  console.log("  proxGen:", new Date(rec.fechaProximaGeneracion).toISOString().slice(0, 10), "(" + dias[new Date(rec.fechaProximaGeneracion).getUTCDay()] + ") | activo:", rec.activo, "| asignacion:", rec.asignacionTipo);

  const p = await db.execute({
    sql: "SELECT id, fechaSolicitada, estado, creadoEn, choferId, entregaId FROM Pedido WHERE pedidoRecurrenteId=? ORDER BY fechaSolicitada DESC LIMIT 12",
    args: [rec.id],
  });
  console.log("=== PEDIDOS láser (más recientes primero) ===");
  for (const x of p.rows) {
    const f = new Date(x.fechaSolicitada);
    const c = new Date(x.creadoEn);
    console.log("  " + f.toISOString().slice(0, 10) + " (" + dias[f.getUTCDay()] + ") | estado=" + x.estado + " | creado=" + c.toISOString().slice(0, 10) + " | entregaId=" + (x.entregaId || "-"));
  }
  const hoy = new Date();
  console.log("\nHoy (UTC):", hoy.toISOString().slice(0, 10), dias[hoy.getUTCDay()]);
})().catch(e => console.error("ERR", e.message));
