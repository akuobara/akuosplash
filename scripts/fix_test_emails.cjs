const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  // Verify column exists
  try {
    await c.execute({ sql: "SELECT mpTestUserEmail FROM AkuoUsuario LIMIT 1" });
  } catch (e) {
    console.log("Agregando columna mpTestUserEmail...");
    await c.execute({ sql: "ALTER TABLE AkuoUsuario ADD COLUMN mpTestUserEmail TEXT" });
  }
  // Fix transtest1 and transtest3 — usar el comprador de prueba (no el marketplace)
  const buyerEmail = "test_user_5223087933429886697@testuser.com";
  for (const email of ["transtest1@akuosplash.test", "transtest3@akuosplash.test"]) {
    await c.execute({ sql: "UPDATE AkuoUsuario SET mpTestUserEmail = ? WHERE email = ?", args: [buyerEmail, email] });
    const r = await c.execute({ sql: "SELECT email, mpTestUserEmail FROM AkuoUsuario WHERE email = ?", args: [email] });
    console.log(`${r.rows[0].email}: mpTestUserEmail = ${r.rows[0].mpTestUserEmail}`);
  }
  console.log("\nListo. transtest1 y transtest3 ahora usan el comprador de prueba.");
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
