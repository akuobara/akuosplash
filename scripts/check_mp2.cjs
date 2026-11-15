const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  const r = await c.execute({ sql: "SELECT mpSubAccessToken, mpSubPublicKey, mpSplitAccessToken, mpSplitUserId, mpSandbox FROM AkuoConfig LIMIT 1" });
  const row = r.rows[0] || {};
  console.log("=== Sub + Split creds ===");
  for (const k of ["mpSubAccessToken","mpSubPublicKey","mpSplitAccessToken","mpSplitUserId","mpSandbox"]) {
    const v = row[k];
    if (typeof v === "string" && v.length > 12) {
      console.log(`${k}: ${v.slice(0,8)}...${v.slice(-4)} (len=${v.length}, TEST=${v.startsWith("TEST-")}, APP=${v.startsWith("APP_USR-")})`);
    } else {
      console.log(`${k}: ${v}`);
    }
  }
  // transtest3
  const u = await c.execute({ sql: "SELECT email, mpTestUserEmail, mpUserId, mpAccessToken, nombre FROM AkuoUsuario WHERE email = ? LIMIT 1", args: ["transtest3@akuosplash.test"] });
  const ur = u.rows[0] || {};
  console.log("\n=== transtest3 ===");
  console.log("email:", ur.email, "| nombre:", ur.nombre);
  console.log("mpTestUserEmail:", ur.mpTestUserEmail || "(vacío)");
  console.log("mpUserId:", ur.mpUserId || "(vacío)");
  const uat = ur.mpAccessToken ? String(ur.mpAccessToken) : "";
  console.log("mpAccessToken:", uat ? uat.slice(0,8)+"..."+uat.slice(-4)+" (TEST="+uat.startsWith("TEST-")+")" : "(vacío)");
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
