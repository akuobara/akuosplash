// Verifica si el deploy de f31196b está live en akuosplash.cl
// buscando "Pagar con Webpay" (nuevo) vs "Inscribir tarjeta" (viejo)
// en los chunks JS del build de Next.js (sin auth).
const base = "https://akuosplash.cl";

// 1. Fetch homepage (sigue redirect a login) → HTML con buildId
const htmlRes = await fetch(base + "/", { redirect: "follow" });
const html = await htmlRes.text();
const m = html.match(/_next\/static\/([A-Za-z0-9_-]+)\/_buildManifest/);
if (!m) {
  console.log("❌ No encontré buildId en el HTML. Status:", htmlRes.status);
  console.log("HTML snippet:", html.slice(0, 300));
  process.exit(1);
}
const buildId = m[1];
console.log("buildId:", buildId);

// 2. Fetch _buildManifest.js → mapping página→chunks
const manRes = await fetch(`${base}/_next/static/${buildId}/_buildManifest.js`);
const man = await manRes.text();

// 3. Encontrar los chunks de /akuosplash/transportista
const pageMatch = man.match(/"\/akuosplash\/transportista":\[((?:[^[\]]|\\\[)*?)\]/);
let chunks = [];
if (pageMatch) {
  chunks = pageMatch[1].match(/static\/chunks\/[^"]+/g) || [];
}
console.log("chunks del transportista:", chunks.length);

// 4. Fetch cada chunk + grep
let foundNuevo = false, foundViejo = false;
for (const c of chunks) {
  const url = `${base}/_next/${c}`;
  const r = await fetch(url);
  const txt = await r.text();
  if (txt.includes("Pagar con Webpay")) { foundNuevo = true; console.log("✅ 'Pagar con Webpay' ENCONTRADO en", c); }
  if (txt.includes("Inscribir tarjeta (Webpay Oneclick)")) { foundViejo = true; console.log("⚠️  'Inscribir tarjeta (Webpay Oneclick)' aún presente en", c); }
}

// 5. También buscar en chunks compartidos (el subscripción-tab puede estar en un chunk common)
// Fetch el _ssgManifest o algunos chunks numerados comunes
console.log("\n--- Resumen ---");
console.log("¿Nuevo código live?:", foundNuevo ? "SÍ ✅" : "NO ❌");
console.log("¿Código viejo aún?:", foundViejo ? "SÍ (deploy no terminó)" : "NO");
