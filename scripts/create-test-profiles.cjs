// Crea 6 perfiles de prueba en AkuoSplash:
// - 4 clientes (buytest2, buytest3, buytest4, Buyer Test User)
// - 2 transportistas (transtest1 con 1 camion, transtest2 con 2 camiones)
//
// Usa el endpoint público /api/akuosplash/auth/register (no requiere auth).
// Para los transportistas, después del registro inicial, hace un PATCH a /api/akuosplash/cliente/perfil
// con los datos del chofer + empresa + vehículo.
//
// Uso: node scripts/create-test-profiles.cjs

const BASE = process.env.AKUO_BASE || "https://akuosplash.cl";

const PROFILES = [
  // 4 clientes (compradores MP sandbox)
  {
    tipo: "cliente",
    email: "buytest2@akuosplash.test",
    password: "TestPass2026!",
    nombre: "Buyer Test 2",
    telefono: "+56912345671",
    rut: "12.345.678-9",
    direccion: "Av. Las Condes 123",
    comuna: "Las Condes",
    lat: -33.4087, lng: -70.5751,
    tipoPersona: "natural",
  },
  {
    tipo: "cliente",
    email: "buytest3@akuosplash.test",
    password: "TestPass2026!",
    nombre: "Buyer Test 3",
    telefono: "+56912345672",
    rut: "12.345.678-1",
    direccion: "Av. Providencia 456",
    comuna: "Providencia",
    lat: -33.4230, lng: -70.6103,
    tipoPersona: "natural",
  },
  {
    tipo: "cliente",
    email: "buytest4@akuosplash.test",
    password: "TestPass2026!",
    nombre: "Buyer Test 4",
    telefono: "+56912345673",
    rut: "12.345.678-2",
    direccion: "Av. Apoquindo 789",
    comuna: "Las Condes",
    lat: -33.3910, lng: -70.5821,
    tipoPersona: "natural",
  },
  {
    tipo: "cliente",
    email: "buyertest@akuosplash.test",
    password: "TestPass2026!",
    nombre: "Buyer Test User",
    telefono: "+56912345674",
    rut: "12.345.678-3",
    direccion: "Av. Manquehue 012",
    comuna: "Vitacura",
    lat: -33.3857, lng: -70.5764,
    tipoPersona: "natural",
  },
  // 2 transportistas (vendedores MP sandbox)
  {
    tipo: "transportista",
    email: "transtest1@akuosplash.test",
    password: "TestPass2026!",
    nombre: "Transport Test 1 (1 camion)",
    telefono: "+56912345675",
    rut: "76.123.456-7",  // RUT empresa
    razonSocial: "Agua Test Uno Ltda.",
    rutEmpresa: "76.123.456-7",
    giro: "Distribución de agua potable",
    direccionEmpresa: "Av. Industrial 100",
    comunaEmpresa: "Quilicura",
    ciudadEmpresa: "Santiago",
    licenciaConducirUrl: "https://example.com/licencia-transtest1.pdf",
    patenteVehiculo: "AB-CD-11",
    tipoVehiculo: "aljibe",
    capacidadVehiculoKg: 5000,
    numCamiones: 1,
    mpUserId: "3738974993",
  },
  {
    tipo: "transportista",
    email: "transtest2@akuosplash.test",
    password: "TestPass2026!",
    nombre: "Transport Test 2 (2 camiones)",
    telefono: "+56912345676",
    rut: "76.987.654-3",
    razonSocial: "Agua Test Dos SpA",
    rutEmpresa: "76.987.654-3",
    giro: "Distribución de agua potable",
    direccionEmpresa: "Av. Comercio 200",
    comunaEmpresa: "Renca",
    ciudadEmpresa: "Santiago",
    licenciaConducirUrl: "https://example.com/licencia-transtest2.pdf",
    patenteVehiculo: "XY-ZW-22",
    tipoVehiculo: "aljibe",
    capacidadVehiculoKg: 8000,
    numCamiones: 2,
    mpUserId: "3774264414",
  },
];

async function registerProfile(p) {
  const body = {
    email: p.email,
    password: p.password,
    nombre: p.nombre,
    telefono: p.telefono,
    rol: p.tipo,
  };
  if (p.tipo === "cliente") {
    Object.assign(body, {
      rut: p.rut,
      direccion: p.direccion,
      comuna: p.comuna,
      lat: p.lat,
      lng: p.lng,
      tipoPersona: p.tipoPersona,
    });
  }
  console.log(`→ Registrando ${p.tipo}: ${p.email}`);
  const res = await fetch(`${BASE}/api/akuosplash/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error && data.error.includes("email")) {
      console.log(`  ✓ Ya existe, salteando`);
      return { alreadyExists: true };
    }
    throw new Error(`Error ${res.status}: ${data.error || JSON.stringify(data)}`);
  }
  console.log(`  ✓ Registrado: ${data.user?.id || "?"}`);
  return data;
}

async function loginProfile(p) {
  const res = await fetch(`${BASE}/api/akuosplash/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: p.email, password: p.password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login ${res.status}: ${data.error}`);
  // Extract session cookie from Set-Cookie header
  const setCookie = res.headers.get("set-cookie") || "";
  const sessionMatch = setCookie.match(/akuosplash_session=([^;]+)/);
  return sessionMatch ? sessionMatch[1] : null;
}

async function completeTransportistaProfile(p, sessionToken) {
  // PATCH /api/akuosplash/cliente/perfil con datos completos
  const body = {
    nombre: p.nombre,
    telefono: p.telefono,
    rut: p.rut,
    // Empresa
    razonSocial: p.razonSocial,
    rutEmpresa: p.rutEmpresa,
    giro: p.giro,
    direccionEmpresa: p.direccionEmpresa,
    comunaEmpresa: p.comunaEmpresa,
    ciudadEmpresa: p.ciudadEmpresa,
    // Chofer (persona natural)
    licenciaConducirUrl: p.licenciaConducirUrl,
    // Vehículo
    patenteVehiculo: p.patenteVehiculo,
    tipoVehiculo: p.tipoVehiculo,
    capacidadVehiculoKg: p.capacidadVehiculoKg,
  };
  const res = await fetch(`${BASE}/api/akuosplash/cliente/perfil`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `akuosplash_session=${sessionToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Perfil ${res.status}: ${data.error}`);
  console.log(`  ✓ Perfil completo: ${p.email}`);
  return data;
}

async function addVehiculo(p, sessionToken, patente, capacidad) {
  // POST /api/akuosplash/vehiculos para crear vehículo extra (el primero ya está en el perfil)
  const body = {
    patente,
    tipo: "aljibe",
    capacidad: capacidad,
    activo: true,
    // 4 fotos requeridas — usar URLs mock para testing
    fotoFrenteUrl: "https://example.com/test-frente.jpg",
    fotoAtrasUrl: "https://example.com/test-atras.jpg",
    fotoDerechaUrl: "https://example.com/test-derecha.jpg",
    fotoIzquierdaUrl: "https://example.com/test-izquierda.jpg",
    // 3 documentos requeridos — URLs mock para testing
    permisoCircUrl: "https://example.com/test-permiso-circ.pdf",
    revisionTecUrl: "https://example.com/test-rev-tec.pdf",
    seguroUrl: "https://example.com/test-seguro.pdf",
  };
  const res = await fetch(`${BASE}/api/akuosplash/vehiculos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `akuosplash_session=${sessionToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Vehículo ${res.status}: ${data.error}`);
  console.log(`  ✓ Vehículo creado: ${patente}`);
  return data;
}

async function main() {
  console.log(`\n=== Creando perfiles de prueba en ${BASE} ===\n`);
  const results = [];
  for (const p of PROFILES) {
    try {
      await registerProfile(p);
      if (p.tipo === "transportista") {
        const token = await loginProfile(p);
        if (token) {
          await completeTransportistaProfile(p, token);
          if (p.numCamiones > 1) {
            // Agregar vehículo extra (el primero está en el perfil)
            for (let i = 1; i < p.numCamiones; i++) {
              const extraPatente = `${p.patenteVehiculo.substring(0, 5)}-${i + 1}`;
              await addVehiculo(p, token, extraPatente, p.capacidadVehiculoKg);
            }
          }
        }
      }
      results.push({ ...p, ok: true });
    } catch (e) {
      console.error(`  ✗ Error: ${e.message}`);
      results.push({ ...p, ok: false, error: e.message });
    }
  }
  console.log(`\n=== Resumen ===`);
  console.log(`Total: ${results.length}`);
  console.log(`OK: ${results.filter(r => r.ok).length}`);
  console.log(`Errores: ${results.filter(r => !r.ok).length}`);
  // Print emails for next steps
  console.log(`\nEmails creados:`);
  results.filter(r => r.ok).forEach(r => console.log(`  ${r.email} (${r.tipo})`));
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
