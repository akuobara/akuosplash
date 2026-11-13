const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  const r = await c.execute({ sql: "SELECT mpSubAccessToken, mpSplitAccessToken, mpSubPublicKey, mpSplitPublicKey, mpSandbox FROM AkuoConfig LIMIT 1" });
  const row = r.rows[0] || {};
  const subToken = String(row.mpSubAccessToken || "");
  const splitToken = String(row.mpSplitAccessToken || "");
  console.log("mpSubAccessToken (first 12):", subToken.slice(0,12) + "...");
  console.log("mpSplitAccessToken (first 12):", splitToken.slice(0,12) + "...");
  console.log("Same token?:", subToken === splitToken);
  console.log("mpSubPublicKey:", row.mpSubPublicKey || "(vacío)");
  console.log("mpSplitPublicKey:", row.mpSplitPublicKey || "(vacío)");

  if (subToken) {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${subToken}` },
    });
    const data = await res.json();
    console.log("\n=== MP /users/me for mpSubAccessToken ===");
    console.log("HTTP:", res.status);
    console.log("user_id:", data.id);
    console.log("nickname:", data.nickname);
    console.log("email:", data.email);
    console.log("tags:", JSON.stringify(data.tags));
    // Compare with the old bad one
    if (data.id === 3738974993) {
      console.log("\n⚠️  SIGUE SIENDO EL TEST USER (mismo user_id 3738974993) — el cambio no se guardó");
    } else {
      console.log("\n✅ USER ID DISTINTO — parece ser la cuenta marketplace");
    }
  }
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
