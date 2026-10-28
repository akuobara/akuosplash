// Verificar usuarios y pedidos en Turso (NO escribe nada, solo lee)
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});

(async () => {
  console.log("=== Usuarios AkuoUsuario ===");
  const u = await db.execute("SELECT id, email, nombre, rol, plan, planActivoHasta, creadoEn FROM AkuoUsuario ORDER BY creadoEn DESC LIMIT 50");
  console.log(`Total: ${u.rows.length}`);
  for (const r of u.rows) {
    console.log(`  - ${r.email} (${r.rol}) plan=${r.plan || '-'} creado=${r.creadoEn}`);
  }
  console.log("\n=== Pedidos AkuoPedidoCliente ===");
  const p = await db.execute("SELECT COUNT(*) as total FROM AkuoPedidoCliente");
  console.log(`Total pedidos: ${p.rows[0].total}`);
  const ult = await db.execute("SELECT id, clienteId, litrosSolicitados, estado, creadoEn FROM AkuoPedidoCliente ORDER BY creadoEn DESC LIMIT 10");
  for (const r of ult.rows) {
    console.log(`  - ${r.id} | cliente=${r.clienteId} | ${r.litrosSolicitados}L | ${r.estado} | ${r.creadoEn}`);
  }
  console.log("\n=== AkuoCliente (clientes del transportista) ===");
  const c = await db.execute("SELECT COUNT(*) as total FROM AkuoCliente");
  console.log(`Total: ${c.rows[0].total}`);
  console.log("\n=== Buscar específicos ===");
  const t = await db.execute("SELECT id, email, nombre, rut, rutEmpresa, razonSocial, patenteVehiculo, capacidadVehiculoKg FROM AkuoUsuario WHERE email LIKE '%transportistatest%' OR email LIKE '%transportatest%' OR email LIKE '%transporttest%' OR email LIKE '%chaloagua%'");
  for (const r of t.rows) {
    console.log(`  TRANSPORTISTA: ${r.email} | rut=${r.rut} | rutEmpresa=${r.rutEmpresa} | razonSocial=${r.razonSocial} | patente=${r.patenteVehiculo} | capacidad=${r.capacidadVehiculoKg}`);
  }
  const cli = await db.execute("SELECT id, email, nombre FROM AkuoUsuario WHERE email LIKE '%clientetest%' OR email LIKE '%clientatest%' OR email LIKE '%clienttest%'");
  for (const r of cli.rows) {
    console.log(`  CLIENTE: ${r.email} | ${r.nombre}`);
  }
  console.log("\n=== AkuoVehiculo ===");
  const v = await db.execute("SELECT id, nombre, patente, capacidad, activo FROM AkuoVehiculo");
  for (const r of v.rows) {
    console.log(`  - ${r.nombre} | patente=${r.patente} | capacidad=${r.capacidad} | activo=${r.activo}`);
  }
})().catch(e => console.error("ERR:", e.message));
