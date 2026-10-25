#!/usr/bin/env node
/**
 * Fix fechas en AkuoUsuario que NO están en formato ISO 8601.
 * Prisma espera "2026-10-25T02:20:08.000Z" pero SQLite por default usa "2026-10-25 02:20:08"
 * (cuando se usa datetime('now')).
 *
 * Esto causaba HTTP 500 en /api/akuosplash/auth/me cuando el usuario logueado tenía
 * fechas en formato no-ISO (creadoEn, ultimoLoginEn, etc.).
 *
 * El script:
 *   - Busca registros con fechas en formato no-ISO (sin 'T' en el medio)
 *   - Las convierte a ISO agregando 'T' y 'Z' (asumiendo UTC)
 *   - Actualiza creadoEn, ultimoLoginEn, planActivoDesde, planActivoHasta, etc.
 */
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

// Convierte "2026-10-25 02:20:08" → "2026-10-25T02:20:08.000Z"
// (asume UTC porque SQLite datetime('now') es UTC por default)
function toISO(sqliteDate) {
  if (!sqliteDate || typeof sqliteDate !== 'string') return sqliteDate;
  // Si ya tiene T, está OK
  if (sqliteDate.includes('T')) return sqliteDate;
  // Si tiene espacio, reemplazarlo por T y agregar .000Z
  if (sqliteDate.includes(' ')) {
    return sqliteDate.replace(' ', 'T') + '.000Z';
  }
  return sqliteDate;
}

// Columnas de fecha en AkuoUsuario
const DATE_COLS = [
  'creadoEn', 'ultimoLoginEn',
  'mpTokenExpiresAt', 'mpConnectedAt',
  'planActivoDesde', 'planActivoHasta',
  'transbankIniciadoEn', 'transbankAutorizadoEn',
  'mpSubIniciadoEn', 'mpSubAutorizadoEn', 'mpSubSuspendedEn',
];

async function main() {
  // Contar registros
  console.log('=== Estado actual de AkuoUsuario ===');
  const all = await client.execute("SELECT id, email, creadoEn, ultimoLoginEn FROM AkuoUsuario ORDER BY creadoEn DESC");
  console.log(`Total usuarios: ${all.rows.length}`);
  
  // Detectar los que tienen fechas no-ISO
  const toFix = [];
  for (const u of all.rows) {
    if (u.creadoEn && !String(u.creadoEn).includes('T')) {
      toFix.push({ id: u.id, email: u.email, creadoEn: u.creadoEn, ultimoLoginEn: u.ultimoLoginEn });
    }
  }
  console.log(`\nUsuarios con fechas no-ISO: ${toFix.length}`);
  for (const u of toFix.slice(0, 10)) {
    console.log(`  - ${u.email} | creadoEn="${u.creadoEn}" | ultimoLoginEn="${u.ultimoLoginEn || 'NULL'}"`);
  }
  
  if (toFix.length === 0) {
    console.log('\n✅ No hay nada que arreglar.');
    return;
  }
  
  // Fix cada registro
  console.log(`\n=== Arreglando ${toFix.length} usuarios ===`);
  let fixed = 0;
  for (const u of toFix) {
    const updates = {};
    for (const col of DATE_COLS) {
      // Leer el valor actual
      const r = await client.execute({
        sql: `SELECT ${col} as v FROM AkuoUsuario WHERE id = ?`,
        args: [u.id],
      });
      const v = r.rows[0]?.v;
      if (v && typeof v === 'string' && !v.includes('T') && v.includes('-') && v.includes(' ')) {
        updates[col] = toISO(v);
      }
    }
    if (Object.keys(updates).length === 0) continue;
    
    // Build UPDATE statement
    const setClauses = Object.keys(updates).map(col => `${col} = ?`).join(', ');
    const args = [...Object.values(updates), u.id];
    await client.execute({
      sql: `UPDATE AkuoUsuario SET ${setClauses} WHERE id = ?`,
      args,
    });
    fixed++;
    if (fixed <= 10) {
      console.log(`  ✓ ${u.email} — actualizado ${Object.keys(updates).length} campos`);
    }
  }
  console.log(`\n✅ ${fixed} usuarios actualizados con fechas ISO`);
  
  // Verificación
  console.log('\n=== Verificación ===');
  const v = await client.execute({
    sql: `SELECT email, creadoEn FROM AkuoUsuario WHERE email IN (?, ?)`,
    args: ['transportistatest@akuosplash.test', 'chofertest@akuosplash.test'],
  });
  for (const u of v.rows) {
    console.log(`  ${u.email} | creadoEn="${u.creadoEn}" | ISO: ${String(u.creadoEn).includes('T') ? '✓' : '✗'}`);
  }
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
