// Ver pedidos existentes + buscar el pedido del clientetest
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});
(async () => {
  console.log("=== Tablas AkuoPedido* disponibles ===");
  const tabs = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'AkuoPedido%'`);
  for (const r of tabs.rows) console.log(`  - ${r.name}`);
  
  console.log("\n=== AkuoPedidoCliente: el único pedido ===");
  const all = await db.execute(`SELECT * FROM AkuoPedidoCliente`);
  for (const r of all.rows) {
    console.log(JSON.stringify(r, null, 2));
  }
  
  console.log("\n=== AkuoPedido (la tabla original) ===");
  try {
    const p = await db.execute(`SELECT COUNT(*) as total FROM AkuoPedido`);
    console.log(`Total AkuoPedido: ${p.rows[0].total}`);
    const recent = await db.execute(`SELECT * FROM AkuoPedido ORDER BY creadoEn DESC LIMIT 5`);
    for (const r of recent.rows) console.log(JSON.stringify(r).substring(0, 300));
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
  
  console.log("\n=== Buscar pedidos del clientetest ===");
  const cliId = "test_cliente_1792976781416";
  // Buscar en todas las tablas AkuoPedido* donde podría estar
  for (const tbl of ["AkuoPedidoCliente", "AkuoPedido", "AkuoEntrega"]) {
    try {
      const r = await db.execute({
        sql: `SELECT COUNT(*) as total FROM ${tbl} WHERE clienteId = ? OR clienteEmail = ?`,
        args: [cliId, "clientetest@akuosplash.test"]
      });
      console.log(`  ${tbl}: ${r.rows[0].total} registros del clientetest`);
    } catch (e) {
      console.log(`  ${tbl}: ERROR - ${e.message.substring(0, 100)}`);
    }
  }
})().catch(e => console.error("ERR:", e.message));
