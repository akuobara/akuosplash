const { createClient } = require('@libsql/client');
const crypto = require('crypto');

const url = 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io';
const authToken = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const client = createClient({ url, authToken });
  
  const email = 'akuobara@gmail.com';
  const nombre = 'Super Admin';
  const password = 'super-admin-2024';
  const passwordHash = hashPassword(password);
  
  // Verificar si ya existe
  const existing = await client.execute({
    sql: 'SELECT id, role FROM Usuario WHERE email = ?',
    args: [email.toLowerCase()],
  });
  
  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    if (user.role === 'super_admin') {
      console.log('El usuario ya es super_admin');
      return;
    }
    // Actualizar rol a super_admin
    await client.execute({
      sql: 'UPDATE Usuario SET role = ?, passwordHash = ? WHERE email = ?',
      args: ['super_admin', passwordHash, email.toLowerCase()],
    });
    console.log('Usuario actualizado a super_admin');
  } else {
    // Crear nuevo
    await client.execute({
      sql: `INSERT INTO Usuario (id, email, passwordHash, nombre, role, activo, creadoEn) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
      args: ['super-admin-' + Date.now(), email.toLowerCase(), passwordHash, nombre, 'super_admin'],
    });
    console.log('Súper admin creado');
  }
  
  console.log('Email:', email);
  console.log('Contraseña:', password);
  console.log('Panel: https://my-project-azure-five-82.vercel.app/super-admin');
}

main().catch(e => console.error(e));
