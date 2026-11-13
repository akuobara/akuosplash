const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  // Check all transportistas with their mpTestUserEmail
  const r = await c.execute({ sql: "SELECT email, nombre, mpTestUserEmail FROM AkuoUsuario WHERE rol IN ('transportista','superadmin') ORDER BY email" });
  console.log("=== Transportistas y sus mpTestUserEmail ===");
  for (const row of r.rows) {
    console.log(`${row.email} (${row.nombre}): mpTestUserEmail = ${row.mpTestUserEmail || "(vacío)"}`);
  }
  console.log("\n=== Marketplace test identity (from /users/me) ===");
  console.log("email: test_user_8470344657267784965@testuser.com");
  console.log("user_id: 3738974993");
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
