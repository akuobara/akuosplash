const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  const r = await c.execute({ sql: "SELECT mpSubAccessToken FROM AkuoConfig LIMIT 1" });
  const token = String(r.rows[0]?.mpSubAccessToken || "");

  // Query the new test user by ID (3738975019 — from the screenshot)
  const newUserId = "3738975019";
  console.log(`=== Test user ${newUserId} (el que creaste) ===`);
  const res1 = await fetch(`https://api.mercadopago.com/users/${newUserId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("HTTP:", res1.status);
  if (res1.ok) {
    const d = await res1.json();
    console.log(`  id=${d.id} | email=${d.email} | nickname=${d.nickname} | tags=${JSON.stringify(d.tags)}`);
  } else {
    console.log("  Error:", await res1.text());
  }

  // Also the marketplace identity for comparison
  console.log(`\n=== Marketplace (3738974993) ===`);
  const res2 = await fetch("https://api.mercadopago.com/users/3738974993", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res2.ok) {
    const d = await res2.json();
    console.log(`  id=${d.id} | email=${d.email} | nickname=${d.nickname}`);
  }

  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
