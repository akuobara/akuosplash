// Verifica si f31196b está live: login por código (dev) → fetch transportista → grep "Pagar con Webpay"
const base = "https://akuosplash.cl";
const email = "transtest3@akuosplash.test";

// 1. Solicitar código
const r1 = await fetch(`${base}/api/akuosplash/auth/solicitar-codigo`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});
const j1 = await r1.json().catch(() => ({}));
console.log("solicitar-codigo:", r1.status, "| _codigoDev:", j1._codigoDev || "(no dev — no puedo loguear)");

if (!j1._codigoDev) {
  console.log("❌ isDev=false en prod → no puedo recuperar el código. Pedile al usuario que pruebe manualmente.");
  process.exit(0);
}

// 2. Verificar código → obtener cookie de sesión
const r2 = await fetch(`${base}/api/akuosplash/auth/verificar-codigo`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, codigo: j1._codigoDev }),
});
const setCookie = r2.headers.get("set-cookie") || "";
console.log("verificar-codigo:", r2.status, "| cookie presente:", !!setCookie);
const cookieMatch = setCookie.match(/([^=]+=[^;]+)/);
if (!cookieMatch) {
  console.log("❌ No llegó cookie de sesión. Respuesta:", await r2.text());
  process.exit(1);
}
const cookie = cookieMatch[1];

// 3. Fetch transportista con cookie → grep
const r3 = await fetch(`${base}/akuosplash/transportista?tab=subscripcion`, {
  headers: { Cookie: cookie },
});
const html = await r3.text();
console.log("transportista page:", r3.status, "| HTML len:", html.length);

const tieneNuevo = html.includes("Pagar con Webpay");
const tieneViejo = html.includes("Inscribir tarjeta (Webpay Oneclick)");
console.log("\n--- Resultado ---");
console.log("¿'Pagar con Webpay' en HTML?:", tieneNuevo ? "SÍ ✅ (deploy live)" : "no");
console.log("¿'Inscribir tarjeta (Oneclick)' aún?:", tieneViejo ? "SÍ (deploy viejo)" : "no");

// Si no está en el HTML SSR, buscar en los chunks JS referenciados en la página
if (!tieneNuevo && !tieneViejo) {
  const chunkUrls = [...new Set(html.match(/\/_next\/static\/chunks\/[A-Za-z0-9_.-]+\.js/g) || [])];
  console.log("\nBuscando en", chunkUrls.length, "chunks JS de la página...");
  let foundNuevo = false, foundViejo = false;
  for (const cu of chunkUrls) {
    const r = await fetch(`${base}${cu}`);
    const t = await r.text();
    if (t.includes("Pagar con Webpay")) { foundNuevo = true; console.log("  ✅ 'Pagar con Webpay' en", cu); }
    if (t.includes("Inscribir tarjeta (Webpay Oneclick)")) { foundViejo = true; console.log("  ⚠️ 'Inscribir tarjeta' en", cu); }
  }
  console.log("\n--- Resultado chunks ---");
  console.log("¿Nuevo live?:", foundNuevo ? "SÍ ✅" : "NO ❌");
  console.log("¿Viejo aún?:", foundViejo ? "SÍ" : "NO");
}
