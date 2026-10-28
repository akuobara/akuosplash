// Login + check what /api/akuosplash/cliente/perfil actually returns
const BASE = "https://akuosplash.cl";
const email = "transportistatest@akuosplash.test";
const password = "test1234"; // asumido, veré si falla

async function main() {
  // 1. Login
  const loginRes = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const loginData = await loginRes.json();
  console.log("Login status:", loginRes.status);
  if (!loginRes.ok) {
    console.log("Login error:", loginData);
    return;
  }
  const cookie = loginRes.headers.get("set-cookie");
  console.log("Cookie header (first 80 chars):", (cookie || "").substring(0, 80));
  
  // Extraer solo el akuosplash_token=... sin el Path
  const tokenMatch = (cookie || "").match(/akuosplash_token=([^;]+)/);
  if (!tokenMatch) {
    console.log("No akuosplash_token in Set-Cookie. Cookies:");
    console.log(" ", cookie);
    return;
  }
  const token = tokenMatch[1];
  console.log("Token (first 60 chars):", token.substring(0, 60));
  
  // 2. Llamar /api/akuosplash/cliente/perfil
  const perfilRes = await fetch(`${BASE}/api/akuosplash/cliente/perfil`, {
    headers: { Cookie: `akuosplash_token=${token}` },
  });
  console.log("\nPerfil status:", perfilRes.status);
  const perfilData = await perfilRes.json();
  
  console.log("\n=== Campos de foto/documento devueltos por la API ===");
  const fields = [
    "licenciaConducirUrl",
    "licenciaConducirAtrasUrl",
    "permisoCircUrl",
    "seguroUrl",
    "revisonTecnicaUrl",
    "patenteVehiculo",
    "tipoVehiculo",
    "capacidadVehiculoKg",
    "fotoVehiculoFrenteUrl",
    "fotoVehiculoAtrasUrl",
    "fotoVehiculoIzquierdaUrl",
    "fotoVehiculoDerechaUrl",
  ];
  for (const f of fields) {
    const v = perfilData.user?.[f];
    const display = v ? (typeof v === "string" && v.length > 60 ? v.substring(0, 60) + "..." : v) : "(vacío o no devuelto)";
    console.log(`  ${f}: ${display}`);
  }
}

main().catch(e => console.error("ERR:", e.message));
