#!/usr/bin/env node
/**
 * Reemplazar los datos REALES del usuario en la cuenta de test
 * por datos FAKE claramente inventados.
 *
 * NO toca el usuario real. Solo modifica los campos de empresa
 * en AkuoUsuario where email=transportistatest@akuosplash.test.
 */
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // Datos FAKE claramente inventados (no usan RUT, dirección, ni nombre reales del usuario)
  const fakeData = {
    razonSocial: "Transportista Demo SpA",
    rutEmpresa: "77.777.777-7", // RUT genérico inventado
    direccionEmpresa: "Av. Siempre Viva 742",
    comunaEmpresa: "Las Condes",
    ciudadEmpresa: "Santiago",
    telefonoEmpresa: "+56988888001",
    emailEmpresa: "demo@transportistatest.cl",
    giro: "Servicios de transporte de agua",
    patenteVehiculo: "TEST-01-AB", // patente inventada
    tipoVehiculo: "aljibe",
    capacidadVehiculoKg: 5000,
  };

  // Actualizar el usuario de test
  const r = await client.execute({
    sql: `UPDATE AkuoUsuario SET
      razonSocial = ?,
      rutEmpresa = ?,
      direccionEmpresa = ?,
      comunaEmpresa = ?,
      ciudadEmpresa = ?,
      telefonoEmpresa = ?,
      emailEmpresa = ?,
      giro = ?,
      patenteVehiculo = ?,
      tipoVehiculo = ?,
      capacidadVehiculoKg = ?
      WHERE email = ?`,
    args: [
      fakeData.razonSocial,
      fakeData.rutEmpresa,
      fakeData.direccionEmpresa,
      fakeData.comunaEmpresa,
      fakeData.ciudadEmpresa,
      fakeData.telefonoEmpresa,
      fakeData.emailEmpresa,
      fakeData.giro,
      fakeData.patenteVehiculo,
      fakeData.tipoVehiculo,
      fakeData.capacidadVehiculoKg,
      "transportistatest@akuosplash.test",
    ],
  });

  console.log(`Filas afectadas: ${r.rowsAffected}`);
  console.log('Datos nuevos (fake):');
  console.log(`  Razón social:        ${fakeData.razonSocial}`);
  console.log(`  RUT empresa:        ${fakeData.rutEmpresa}`);
  console.log(`  Dirección:           ${fakeData.direccionEmpresa}`);
  console.log(`  Comuna:              ${fakeData.comunaEmpresa}`);
  console.log(`  Ciudad:              ${fakeData.ciudadEmpresa}`);
  console.log(`  Teléfono empresa:    ${fakeData.telefonoEmpresa}`);
  console.log(`  Email empresa:       ${fakeData.emailEmpresa}`);
  console.log(`  Giro:                ${fakeData.giro}`);
  console.log(`  Patente vehículo:    ${fakeData.patenteVehiculo}`);
  console.log(`  Capacidad:           ${fakeData.capacidadVehiculoKg} L`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
