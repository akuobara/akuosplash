const crypto = require('crypto');
const { createClient } = require('@libsql/client');
const c = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync('Test1234!', salt, 64).toString('hex');
const passwordHash = salt + ':' + hash;

const id = 'test_tran3_' + Date.now();
const ahora = new Date().toISOString();

c.execute({
  sql: `INSERT INTO AkuoUsuario (id, email, nombre, passwordHash, rol, plan, activo, aprobado, banned, suscripcionActiva, creadoEn, ultimoLoginEn, mpTestUserEmail, razonSocial, patenteVehiculo, tipoVehiculo, capacidadVehiculoKg, rut, rutEmpresa, licenciaConducirUrl, permisoCircUrl, seguroUrl, fotoVehiculoFrenteUrl, fotoVehiculoAtrasUrl, fotoVehiculoDerechaUrl, fotoVehiculoIzquierdaUrl)
  VALUES (?, ?, ?, ?, ?, ?, 1, 1, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  args: [
    id, 'transtest3@akuosplash.test', 'Transport Test 3', passwordHash,
    'transportista', 'free', ahora, ahora,
    'test_user_8470344657267784965@testuser.com',
    'Test Transport SpA', 'TEST-03-CD', 'aljibe', 5000,
    '12345678-9', '98765432-1',
    'https://example.com/licencia.pdf', 'https://example.com/permiso.pdf', 'https://example.com/seguro.pdf',
    'https://example.com/frente.jpg', 'https://example.com/atras.jpg', 'https://example.com/derecha.jpg', 'https://example.com/izquierda.jpg'
  ]
}).then(() => {
  console.log('NEW account created:');
  console.log('  Email: transtest3@akuosplash.test');
  console.log('  Password: Test1234!');
  console.log('  Plan: free (sin subscripción)');
  console.log('  MP test email: test_user_8470344657267784965@testuser.com');

  // Also verify transtest1 password
  return c.execute({sql:"SELECT passwordHash FROM AkuoUsuario WHERE email = 'transtest1@akuosplash.test'"});
}).then(r => {
  const [s2, h2] = String(r.rows[0].passwordHash).split(':');
  const vh2 = crypto.scryptSync('Test1234!', s2, 64).toString('hex');
  console.log('\ntranstest1 password Test1234! matches:', h2 === vh2);
}).catch(e => console.error('ERROR:', e.message));
