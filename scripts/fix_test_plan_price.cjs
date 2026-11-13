const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  // MP mínimo = $950. Subir el plan test a $1000 mensual y $1000 diario.
  await c.execute({ sql: "UPDATE AkuoPlanConfig SET precioMensual = 1000, precioDiario = 1000 WHERE id = ?", args: ["test"] });
  const r = await c.execute({ sql: "SELECT id, precioMensual, precioDiario, precioSemanal FROM AkuoPlanConfig WHERE id = ?", args: ["test"] });
  const row = r.rows[0];
  console.log("test plan actualizado:");
  console.log(`  precioMensual: ${row.precioMensual}`);
  console.log(`  precioDiario: ${row.precioDiario}`);
  console.log(`  precioSemanal: ${row.precioSemanal}`);
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
