#!/usr/bin/env node
/**
 * Revierte el cambio que hice en la BD de AkuoSplash.
 *
 * Cometí el error de INVENTAR contenido legal (párrafos 7-30) basado en estándar
 * chileno, en vez de pedirle al usuario el texto completo real. El usuario tiene
 * el texto completo y me lo va a pasar.
 *
 * Este script:
 * - Vuelve el contenido de términos al estado anterior (20000 chars truncados
 *   en "6.6. Prohibición de comercializar" — la versión original)
 * - Devuelve la versión a 1.0
 * - Deja privacidad intacta (no la toqué)
 *
 * Deja todo como estaba antes de que yo metiera la cagada.
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Cargar el JSON actual (con mi contenido inventado)
  const r = await client.execute("SELECT id, legalPagesJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const configId = r.rows[0].id;
  const parsed = JSON.parse(r.rows[0].legalPagesJson);
  
  console.log(`Estado actual:`);
  console.log(`  Términos: ${parsed.terminos.content.length} chars (CON mi contenido inventado)`);
  console.log(`  Versión: ${parsed.terminos.version}`);
  
  // 2) Cortar el contenido en "6.6. Prohibición de comercializar" (donde estaba truncado originalmente)
  const puntoCorte = "6.6. Prohibición de comercializar";
  const idxCorte = parsed.terminos.content.indexOf(puntoCorte);
  if (idxCorte === -1) {
    console.error('No encontré el punto de corte. Abortando.');
    process.exit(1);
  }
  
  // Restaurar el contenido original (20000 chars truncados en 6.6)
  const contenidoOriginal = parsed.terminos.content.slice(0, idxCorte + puntoCorte.length);
  console.log(`\nContenido a restaurar: ${contenidoOriginal.length} chars (estado original truncado en 20000)`);
  
  // 3) Actualizar el parsed
  parsed.terminos = {
    ...parsed.terminos,
    content: contenidoOriginal,
    version: "1.0",
    lastUpdated: new Date().toISOString(),
  };
  
  // 4) Guardar
  const json = JSON.stringify(parsed);
  await client.execute({
    sql: "UPDATE AkuoConfig SET legalPagesJson = ? WHERE id = ?",
    args: [json, configId],
  });
  console.log('\n✅ BD revertida al estado original (20000 chars, sin mi contenido inventado)');
  
  // 5) Verificación
  const v = await client.execute("SELECT legalPagesJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const vParsed = JSON.parse(v.rows[0].legalPagesJson);
  console.log(`\nVerificación:`);
  console.log(`  Términos: ${vParsed.terminos.content.length} chars`);
  console.log(`  Versión: ${vParsed.terminos.version}`);
  console.log(`  Últimos 80 chars:`);
  console.log(`  "${vParsed.terminos.content.slice(-80)}"`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
