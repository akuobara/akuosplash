const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  const r = await c.execute({ sql: "SELECT mpSubAccessToken FROM AkuoConfig LIMIT 1" });
  const token = String(r.rows[0]?.mpSubAccessToken || "");
  if (!token) { console.log("No hay token"); await c.close(); return; }

  // 1. List test users created by this account
  console.log("=== Test users del marketplace (GET /users/test) ===");
  const res1 = await fetch("https://api.mercadopago.com/users/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("HTTP:", res1.status);
  const data1 = await res1.json();
  if (Array.isArray(data1)) {
    for (const u of data1) {
      console.log(`  id=${u.id} | email=${u.email} | nickname=${u.nickname} | site_id=${u.site_id}`);
    }
    console.log(`Total: ${data1.length} test users`);
  } else {
    console.log(JSON.stringify(data1).slice(0, 500));
  }

  // 2. Who is the token owner
  console.log("\n=== Quién es el token owner (GET /users/me) ===");
  const res2 = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data2 = await res2.json();
  console.log(`  id=${data2.id} | email=${data2.email} | nickname=${data2.nickname} | tags=${JSON.stringify(data2.tags)}`);

  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
