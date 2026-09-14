import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPasswordCliente, signTokenCliente, setSessionCookieCliente } from "@/lib/auth-cliente";

// POST /api/cliente/auth/registro
// Registro de un nuevo cliente de la app (sin vincular a ningún admin)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Campos obligatorios (sin zonaId — se asigna automáticamente por ubicación)
    if (!body.email?.trim() || !body.password || !body.nombre?.trim() || !body.rut?.trim() || !body.telefono?.trim()) {
      return NextResponse.json(
        { error: "Nombre, RUT, teléfono, email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    if (String(body.password).length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Asignar zona automáticamente según lat/lng
    // Si el cliente envió ubicación, buscar la zona cuyo polígono contiene el punto
    // Si no hay polígono, usar radioKm desde el centro
    // Si no hay zona que coincida, usar la primera zona activa como fallback
    let zonaId: string | null = null;
    const lat = body.lat != null && body.lat !== "" ? Number(body.lat) : null;
    const lng = body.lng != null && body.lng !== "" ? Number(body.lng) : null;

    if (lat != null && lng != null) {
      const zonasActivas = await db.zona.findMany({ where: { activa: true } });
      for (const z of zonasActivas) {
        if (z.zonaGeoJson) {
          try {
            const geo = JSON.parse(z.zonaGeoJson);
            if (geo.type === "Polygon" && geo.coordinates?.[0]) {
              if (pointInPolygon([lng, lat], geo.coordinates[0])) {
                zonaId = z.id;
                break;
              }
            }
          } catch {}
        }
        if (!zonaId && z.radioKm != null && z.centroLat != null && z.centroLng != null) {
          const dist = haversine(lat, lng, z.centroLat, z.centroLng);
          if (dist <= z.radioKm) {
            zonaId = z.id;
            break;
          }
        }
      }
    }

    // Fallback: si no se encontró zona por ubicación, usar la primera activa
    if (!zonaId) {
      const primeraZona = await db.zona.findFirst({ where: { activa: true } });
      if (primeraZona) {
        zonaId = primeraZona.id;
      } else {
        return NextResponse.json(
          { error: "No hay zonas activas. Contactá al administrador." },
          { status: 400 }
        );
      }
    }

    const emailNorm = body.email.trim().toLowerCase();

    // Verificar email duplicado
    const existente = await db.clienteApp.findUnique({ where: { email: emailNorm } });
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email. Iniciá sesión." },
        { status: 409 }
      );
    }

    // Normalizar teléfono
    let telefonoNormalizado: string | null = null;
    if (body.telefono?.trim()) {
      const digits = body.telefono.replace(/\D/g, "");
      if (digits.length >= 8) telefonoNormalizado = "+" + digits;
    }

    // Crear cliente-app
    const nuevo = await db.clienteApp.create({
      data: {
        email: emailNorm,
        passwordHash: hashPasswordCliente(String(body.password)),
        nombre: body.nombre.trim(),
        rut: body.rut?.trim() || null,
        telefono: telefonoNormalizado,
        direccion: body.direccion?.trim() || null,
        zonaId: zonaId,
        lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
        lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
        // Acceso
        requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
        entregaDesdeAfuera: !!body.entregaDesdeAfuera,
        conexionExterna: !!body.conexionExterna,
        requiereClientePresente: body.requiereClientePresente !== false,
        indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
        // Uso del agua
        usoAgua: body.usoAgua || "consumo",
        usoAguaNota: body.usoAguaNota?.trim() || null,
        estanquesJson: body.estanquesJson || null,
        // Preferencias
        tiempoAceptacionPreferidoMin: Number(body.tiempoAceptacionPreferidoMin) || 15,
        saldo: 0,
        entregasExitosas: 0,
        activo: true,
      },
    });

    // Generar JWT (sin duenoId porque no pertenece a ningún admin)
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    const token = await signTokenCliente({
      clienteId: nuevo.id,
      email: emailNorm,
      nombre: nuevo.nombre,
      duenoId: "", // vacío: el cliente no tiene admin
    });
    await setSessionCookieCliente(token, isHttps);

    return NextResponse.json({
      cliente: {
        id: nuevo.id,
        nombre: nuevo.nombre,
        email: nuevo.email,
      },
      token,
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}

// === Helpers para asignar zona por ubicación ===

// Verifica si un punto [lng, lat] está dentro de un polígono (ray casting)
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distancia haversine en km entre dos puntos [lat, lng]
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
