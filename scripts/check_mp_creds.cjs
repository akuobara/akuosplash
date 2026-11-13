const { createClient } = require("@libsql/client");
const c = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"
});
async function main() {
  // List columns of AkuoConfig
  const cols = await c.execute({ sql: "PRAGMA table_info(AkuoConfig)" });
  const names = cols.rows.map(r => r.name).filter(n => n.toLowerCase().includes("mp"));
  console.log("AkuoConfig MP columns:", names);
  // Get all MP columns
  const r = await c.execute({ sql: `SELECT ${names.join(", ")} FROM AkuoConfig LIMIT 1` });
  const row = r.rows[0] || {};
  console.log("\n=== AkuoConfig MP values ===");
  for (const k of names) {
    const v = row[k];
    if (k.toLowerCase().includes("token") && v) {
      const s = String(v);
      console.log(`${k}: ${s.slice(0,8)}...${s.slice(-4)} (len=${s.length}, TEST=${s.startsWith("TEST-")}, APP=${s.startsWith("APP_USR-")})`);
    } else {
      console.log(`${k}: ${v}`);
    }
  }
  // transtest3
  const ucols = await c.execute({ sql: "PRAGMA table_info(AkuoUsuario)" });
  const unames = ucols.rows.map(r => r.name).filter(n => n.toLowerCase().includes("mp") || n.toLowerCase().includes("email") || n.toLowerCase().includes("nombre"));
  const u = await c.execute({ sql: `SELECT ${unames.join(", ")} FROM AkuoUsuario WHERE email = ? LIMIT 1`, args: ["transtest3@akuosplash.test"] });
  const ur = u.rows[0] || {};
  console.log("\n=== transtest3 ===");
  for (const k of unames) {
    const v = ur[k];
    if (k.toLowerCase().includes("token") && v) {
      const s = String(v);
      console.log(`${k}: ${s.slice(0,8)}...${s.slice(-4)} (TEST=${s.startsWith("TEST-")})`);
    } else {
      console.log(`${k}: ${v}`);
    }
  }
  await c.close();
}
main().catch(e=>console.error("ERR:", e.message));
