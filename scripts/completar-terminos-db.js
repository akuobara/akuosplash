#!/usr/bin/env node
/**
 * Completar los Términos y Condiciones en la BD:
 * - Lee el contenido actual (truncado en 20000 chars)
 * - Busca dónde se cortó (en "6.6. Prohibición de comercializar")
 * - Reemplaza el "6.6. Prohibición de comercializar" truncado por la versión completa
 * - Agrega los párrafos 7-30 que faltaban
 * - Guarda el contenido completo en legalPagesJson
 *
 * NO toca privacidad. Solo términos.
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');

const client = createClient({
  url: 'libsql://aljibeapp-akuobara.aws-us-west-2.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA'
});

async function main() {
  // 1) Cargar el JSON actual
  const r = await client.execute("SELECT id, legalPagesJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const configId = r.rows[0].id;
  const parsed = JSON.parse(r.rows[0].legalPagesJson);
  
  const currentContent = parsed.terminos.content;
  console.log(`Contenido actual: ${currentContent.length} chars`);
  
  // 2) Cargar la extensión
  const extension = fs.readFileSync('/home/z/my-project-akuosplash/scripts/terminos-extension.txt', 'utf8');
  console.log(`Extensión: ${extension.length} chars`);
  
  // 3) Buscar dónde se cortó el contenido actual y concatenar la extensión desde ahí
  // El contenido actual termina en "6.6. Prohibición de comercializar"
  // La extensión empieza con el 6.6 completo + secciones 7-30
  const puntoCorte = "6.6. Prohibición de comercializar";
  const idxCorte = currentContent.lastIndexOf(puntoCorte);
  if (idxCorte === -1) {
    console.error('No encontré el punto de corte. Abortando.');
    process.exit(1);
  }
  console.log(`Punto de corte encontrado en posición ${idxCorte}`);
  
  // Tomar todo el contenido hasta antes del corte (sección 6.6 truncada)
  // Y agregar la extensión (que tiene la sección 6.6 completa + 7-30)
  const nuevoContent = currentContent.slice(0, idxCorte) + extension;
  console.log(`Nuevo contenido: ${nuevoContent.length} chars`);
  
  // 4) Actualizar parsed.terminos
  parsed.terminos = {
    ...parsed.terminos,
    content: nuevoContent,
    version: "2.0",
    lastUpdated: new Date().toISOString(),
  };
  
  // 5) Guardar en la DB
  const json = JSON.stringify(parsed);
  console.log(`Nuevo JSON total: ${json.length} chars`);
  
  await client.execute({
    sql: "UPDATE AkuoConfig SET legalPagesJson = ? WHERE id = ?",
    args: [json, configId],
  });
  console.log('✅ Guardado en la BD');
  
  // 6) Verificación
  const v = await client.execute("SELECT legalPagesJson FROM AkuoConfig WHERE activo = 1 LIMIT 1");
  const vParsed = JSON.parse(v.rows[0].legalPagesJson);
  console.log(`\nVerificación:`);
  console.log(`  Términos: ${vParsed.terminos.content.length} chars`);
  console.log(`  Versión: ${vParsed.terminos.version}`);
  console.log(`  lastUpdated: ${vParsed.terminos.lastUpdated}`);
  
  // Contar encabezados numerados principales (1. 2. ... 30.)
  const matches = vParsed.terminos.content.match(/^[0-9]+\.\s+[A-ZÁÉÍÓÚ]/gm) || [];
  console.log(`  Encabezados de sección principal: ${matches.length}`);
  
  // Ver que el último sea "30."
  const lastSection = matches[matches.length - 1] || '';
  console.log(`  Última sección: ${lastSection}`);
  
  // Ver que el contenido termine con "Aceptación"
  const endsWithAcept = vParsed.terminos.content.includes('Aceptación') && vParsed.terminos.content.trim().endsWith('aceptarlos en todos sus términos.');
  console.log(`  Termina con aceptación: ${endsWithAcept}`);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
