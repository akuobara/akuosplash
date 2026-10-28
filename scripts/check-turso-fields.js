// Diagnóstico: comparar lo que Turso tiene vs lo que la API devuelve.
// Leo directo de Turso para tener la ground truth.
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});

(async () => {
  // Consulta exactamente los campos que el API endpoint debería devolver
  console.log("=== Campos en AkuoUsuario para transportistatest ===");
  const cols = await db.execute(`PRAGMA table_info(AkuoUsuario)`);
  const colNames = cols.rows.map(r => r.name).sort();
  console.log("Columnas existentes:");
  for (const cn of colNames) {
    if (cn.toLowerCase().includes("licencia") || cn.toLowerCase().includes("foto") || cn.toLowerCase().includes("permiso") || cn.toLowerCase().includes("seguro") || cn.toLowerCase().includes("revison") || cn.toLowerCase().includes("patente") || cn.toLowerCase().includes("vehiculo") || cn.toLowerCase().includes("capacidad")) {
      console.log(`  ✓ ${cn}`);
    }
  }
  
  console.log("\n=== Datos del transportistatest (estos son los que la API debería devolver) ===");
  const r = await db.execute({
    sql: `SELECT licenciaConducirUrl, licenciaConducirAtrasUrl, permisoCircUrl, seguroUrl, revisonTecnicaUrl, fotoVehiculoFrenteUrl, fotoVehiculoAtrasUrl, fotoVehiculoIzquierdaUrl, fotoVehiculoDerechaUrl FROM AkuoUsuario WHERE email = ?`,
    args: ["transportistatest@akuosplash.test"]
  });
  if (r.rows.length === 0) {
    console.log("USER NOT FOUND");
    return;
  }
  const row = r.rows[0];
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (!v) {
      console.log(`  ${k}: (null o vacío)`);
    } else {
      console.log(`  ${k}: ${v.substring(0, 100)}${v.length > 100 ? "..." : ""}`);
    }
  }
})().catch(e => console.error("ERR:", e.message));
