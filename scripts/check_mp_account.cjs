const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  // Get the sub access token
  const r = await c.execute({ sql: "SELECT mpSubAccessToken, mpSplitAccessToken, mpSandbox FROM AkuoConfig LIMIT 1" });
  const row = r.rows[0] || {};
  const subToken = String(row.mpSubAccessToken || "");
  const splitToken = String(row.mpSplitAccessToken || "");
  console.log("mpSubAccessToken (first 12):", subToken.slice(0,12) + "...");
  console.log("mpSplitAccessToken (first 12):", splitToken.slice(0,12) + "...");
  console.log("Same token?:", subToken === splitToken);
  console.log("mpSandbox:", row.mpSandbox);

  // Query MP API to see who this token belongs to
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
    console.log("is_test:", data.is_test);
    console.log("site_id:", data.site_id);
    if (data.tags) console.log("tags:", JSON.stringify(data.tags));
  }
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
