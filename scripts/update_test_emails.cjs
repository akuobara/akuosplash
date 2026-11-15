const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  // Email derivado del test user nuevo (TESTUSER2094743021490827193, user_id 3738975019)
  const newEmail = "test_user_2094743021490827193@testuser.com";
  for (const email of ["transtest1@akuosplash.test", "transtest3@akuosplash.test", "transtest2@akuosplash.test", "transportistatest@akuosplash.test"]) {
    await c.execute({ sql: "UPDATE AkuoUsuario SET mpTestUserEmail = ? WHERE email = ?", args: [newEmail, email] });
    const r = await c.execute({ sql: "SELECT email, mpTestUserEmail FROM AkuoUsuario WHERE email = ?", args: [email] });
    if (r.rows[0]) console.log(`${r.rows[0].email}: ${r.rows[0].mpTestUserEmail}`);
  }
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
