// Inspeccionar datos específicos de los usuarios de test (sin escribir nada)
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});

(async () => {
  console.log("=== Datos completos de transportistatest@akuosplash.test ===");
  const t = await db.execute({
    sql: `SELECT * FROM AkuoUsuario WHERE email = ?`,
    args: ["transportistatest@akuosplash.test"]
  });
  if (t.rows.length > 0) {
    const r = t.rows[0];
    for (const k of Object.keys(r)) {
      if (r[k] === null || r[k] === undefined || r[k] === "") continue;
      console.log(`  ${k}: ${String(r[k]).substring(0, 200)}`);
    }
  } else {
    console.log("  NO ENCONTRADO");
  }
  
  console.log("\n=== Datos completos de clientetest@akuosplash.test ===");
  const c = await db.execute({
    sql: `SELECT id, email, nombre, rol, rut, direccion, comuna, lat, lng, creadoEn FROM AkuoUsuario WHERE email = ?`,
    args: ["clientetest@akuosplash.test"]
  });
  for (const r of c.rows) {
    for (const k of Object.keys(r)) {
      console.log(`  ${k}: ${r[k]}`);
    }
  }
  
  console.log("\n=== Pedidos del cliente test ===");
  // Primero ver las columnas de AkuoPedidoCliente
  const cols = await db.execute(`PRAGMA table_info(AkuoPedidoCliente)`);
  console.log("Columnas AkuoPedidoCliente:");
  for (const r of cols.rows) {
    console.log(`  - ${r.name} (${r.type})`);
  }
  
  console.log("\n=== Pedidos donde clienteId contiene el id del cliente test ===");
  const cliId = c.rows[0]?.id;
  console.log(`clienteId: ${cliId}`);
  const p = await db.execute({
    sql: `SELECT * FROM AkuoPedidoCliente WHERE clienteId = ? OR clienteEmail = ? ORDER BY creadoEn DESC LIMIT 20`,
    args: [cliId, "clientetest@akuosplash.test"]
  });
  console.log(`Pedidos encontrados: ${p.rows.length}`);
  for (const r of p.rows) {
    console.log(`  - ${JSON.stringify(r).substring(0, 300)}`);
  }
  
  console.log("\n=== Todos los pedidos recientes (sin filtro) ===");
  const allP = await db.execute(`SELECT * FROM AkuoPedidoCliente ORDER BY creadoEn DESC LIMIT 5`);
  console.log(`Total: ${allP.rows.length}`);
  for (const r of allP.rows) {
    console.log(`  - ${JSON.stringify(r).substring(0, 250)}`);
  }
  
  console.log("\n=== AkuoCliente (clientes asociados al transportista) ===");
  const cl = await db.execute(`SELECT COUNT(*) as total FROM AkuoCliente`);
  console.log(`Total AkuoCliente: ${cl.rows[0].total}`);
  const clt = await db.execute(`SELECT * FROM AkuoCliente LIMIT 10`);
  for (const r of clt.rows) {
    console.log(`  - ${JSON.stringify(r).substring(0, 200)}`);
  }
})().catch(e => console.error("ERR:", e.message, e.stack));
