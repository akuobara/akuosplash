#!/usr/bin/env node
/**
 * Crea 2 usuarios de prueba en AkuoSplash:
 *   1. Transportista (con plan free, 1 vehículo permitido)
 *   2. Chofer asociado al transportista
 *
 * Passwords: "Test1234!" para ambos
 *
 * NO toca usuarios existentes.
 */
const { createClient } = require('@libsql/client');
const bcrypt = require('/home/z/my-project-akuosplash/node_modules/bcryptjs');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const PASSWORD = 'Test1234!';

async function main() {
  // Generar hash del password (10 rounds, mismo que register route)
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  console.log(`Password hash generado: ${passwordHash.slice(0, 30)}...`);
  
  // ============ 1) Crear Transportista de prueba ============
  const transEmail = 'transportistatest@akuosplash.test';
  const transId = 'test_transp_' + Date.now();
  
  // Verificar si ya existe
  const existTrans = await client.execute({
    sql: "SELECT id FROM AkuoUsuario WHERE email = ?",
    args: [transEmail],
  });
  if (existTrans.rows.length > 0) {
    console.log(`\n⚠️  Transportista ${transEmail} ya existe. Lo salteo.`);
  } else {
    await client.execute({
      sql: `INSERT INTO AkuoUsuario (
        id, email, nombre, telefono, passwordHash, rol, activo, aprobado,
        razonSocial, rutEmpresa, direccionEmpresa, ciudadEmpresa, comunaEmpresa,
        tipoVehiculo, patenteVehiculo, capacidadVehiculoKg,
        plan, suscripcionActiva, vehiculosPermitidos, choferesPermitidos,
        creadoEn
      ) VALUES (?, ?, ?, ?, ?, 'transportista', 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'free', 0, 1, 2, datetime('now'))`,
      args: [
        transId,
        transEmail,
        'Transportista Test Demo',
        '+56988888001',
        passwordHash,
        'AkuoLogistic Test SpA',
        '78522661-5',
        'Morandé 835, of 1107',
        'Santiago',
        'Santiago Centro',
        'camion aljibe',
        'TESTTR01',
        5000,
      ],
    });
    console.log(`\n✅ Transportista creado:`);
    console.log(`   Email:    ${transEmail}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   ID:       ${transId}`);
    console.log(`   Rol:      transportista`);
    console.log(`   Aprobado: 1 (sí, listo para usar)`);
    console.log(`   Plan:    free (1 vehículo, 2 choferes permitidos)`);
    console.log(`   Vehículo: patente TESTTR01, 5000L, camion aljibe`);
  }
  
  // ============ 2) Crear Chofer de prueba ============
  const choferEmail = 'chofertest@akuosplash.test';
  const choferId = 'test_chofer_' + Date.now();
  
  const existChofer = await client.execute({
    sql: "SELECT id FROM AkuoUsuario WHERE email = ?",
    args: [choferEmail],
  });
  if (existChofer.rows.length > 0) {
    console.log(`\n⚠️  Chofer ${choferEmail} ya existe. Lo salteo.`);
  } else {
    await client.execute({
      sql: `INSERT INTO AkuoUsuario (
        id, email, nombre, telefono, passwordHash, rol, activo, aprobado,
        licenciaConducirUrl, descripcion, creadoEn
      ) VALUES (?, ?, ?, ?, ?, 'chofer', 1, 1, ?, 'Chofer de prueba - Transportista Test Demo', datetime('now'))`,
      args: [
        choferId,
        choferEmail,
        'Chofer Test Demo',
        '+56988888002',
        passwordHash,
        'licencia-clase-a-profesional.pdf',
      ],
    });
    console.log(`\n✅ Chofer creado:`);
    console.log(`   Email:    ${choferEmail}`);
    console.log(`   Password: ${PASSWORD}`);
    console.log(`   ID:       ${choferId}`);
    console.log(`   Rol:      chofer`);
    console.log(`   Aprobado: 1 (sí, listo para usar)`);
  }
  
  // ============ Verificación final ============
  console.log(`\n=== Verificación ===`);
  const v1 = await client.execute({
    sql: "SELECT email, nombre, rol, aprobado, plan, vehiculosPermitidos, choferesPermitidos FROM AkuoUsuario WHERE email IN (?, ?)",
    args: [transEmail, choferEmail],
  });
  for (const r of v1.rows) {
    console.log(`  ${r.email} | ${r.nombre} | rol=${r.rol} | aprobado=${r.aprobado}${r.plan ? ` | plan=${r.plan}` : ''}${r.vehiculosPermitidos ? ` | vehiculosPermitidos=${r.vehiculosPermitidos}` : ''}${r.choferesPermitidos ? ` | choferesPermitidos=${r.choferesPermitidos}` : ''}`);
  }
  
  // Login de prueba para confirmar que el password funcione
  console.log(`\n=== Test de login (verificar password) ===`);
  const uTrans = await client.execute({
    sql: "SELECT passwordHash FROM AkuoUsuario WHERE email = ?",
    args: [transEmail],
  });
  if (uTrans.rows.length > 0) {
    const valid = await bcrypt.compare(PASSWORD, uTrans.rows[0].passwordHash);
    console.log(`  Login transportistatest@akuosplash.test / ${PASSWORD}: ${valid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
  }
  const uChofer = await client.execute({
    sql: "SELECT passwordHash FROM AkuoUsuario WHERE email = ?",
    args: [choferEmail],
  });
  if (uChofer.rows.length > 0) {
    const valid = await bcrypt.compare(PASSWORD, uChofer.rows[0].passwordHash);
    console.log(`  Login chofertest@akuosplash.test / ${PASSWORD}: ${valid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
  }
  
  console.log(`\n=== URL para loguearse ===`);
  console.log(`  Login: https://akuosplash.cl/akuosplash`);
  console.log(`  (tocá "Ingresar" → ingresá email + password)`);
  console.log(`\n  - Transportista: transportistatest@akuosplash.test / ${PASSWORD}`);
  console.log(`  - Chofer:        chofertest@akuosplash.test / ${PASSWORD}`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
