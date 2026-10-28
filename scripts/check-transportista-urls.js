// Ver URLs de documentos del transportistatest (solo lectura)
const { createClient } = require("@libsql/client");
const db = createClient({
  url: "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
});
(async () => {
  const r = await db.execute({
    sql: `SELECT 
      licenciaConducirUrl,
      licenciaConducirAtrasUrl,
      permisoCircUrl,
      seguroUrl,
      revisonTecnicaUrl,
      fotoVehiculoFrenteUrl,
      fotoVehiculoAtrasUrl,
      fotoVehiculoIzquierdaUrl,
      fotoVehiculoDerechaUrl,
      patenteVehiculo,
      capacidadVehiculoKg,
      tipoVehiculo,
      rut, rutEmpresa, razonSocial
    FROM AkuoUsuario WHERE email = ?`,
    args: ["transportistatest@akuosplash.test"]
  });
  if (r.rows.length === 0) { console.log("NO ENCONTRADO"); return; }
  const row = r.rows[0];
  console.log("=== URLs guardadas en Turso ===");
  for (const k of Object.keys(row)) {
    console.log(`${k}:`);
    console.log(`  ${row[k] || '(vacío)'}`);
  }
})().catch(e => console.error("ERR:", e.message));
