// GET /api/akuosplash/transportista/vehiculos — lista vehículos del transportista
// POST /api/akuosplash/transportista/vehiculos — crea vehículo (respeta límite freemium)
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
    where: { transportistaId: user.id },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({ vehiculos, limite: user.vehiculosPermitidos });
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const patente = body.patente?.trim().toUpperCase();
    const tipo = body.tipo || "aljibe";
    const capacidadLitros = Number(body.capacidadLitros);

    if (!patente) {
      return NextResponse.json({ error: "Patente es obligatoria" }, { status: 400 });
    }
    if (!capacidadLitros || capacidadLitros <= 0) {
      return NextResponse.json({ error: "Capacidad en litros debe ser > 0" }, { status: 400 });
    }
    if (!["aljibe", "tolva", "cerrado", "plano"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo de vehículo inválido" }, { status: 400 });
    }

    // === FREEMIUM: controlar límite ===
    const cantidadActual = await akuosplashDb.akuoVehiculo.count({
      where: { transportistaId: user.id },
    });
    const limite = user.vehiculosPermitidos;
    // enterprise = 999 → se considera ilimitado en la UI
    if (limite < 999 && cantidadActual >= limite) {
      return NextResponse.json(
        {
          error: `Tu plan ${user.plan} permite hasta ${limite} vehículo(s). Mejorá tu suscripción para agregar más.`,
          codigo: "LIMITE_VEHICULOS_ALCANZADO",
          limite,
          plan: user.plan,
        },
        { status: 402 }
      );
    }

    // Verificar patente duplicada (por transportista)
    const dup = await akuosplashDb.akuoVehiculo.findFirst({
      where: { transportistaId: user.id, patente },
    });
    if (dup) {
      return NextResponse.json({ error: "Ya tenés un vehículo con esa patente" }, { status: 409 });
    }

    const vehiculo = await akuosplashDb.akuoVehiculo.create({
      data: {
        transportistaId: user.id,
        patente,
        tipo,
        capacidadLitros,
        marca: body.marca?.trim() || null,
        modelo: body.modelo?.trim() || null,
        año: body.año ? Number(body.año) : null,
        permisoCircUrl: body.permisoCircUrl || null,
        revisionTecUrl: body.revisionTecUrl || null,
        seguroUrl: body.seguroUrl || null,
        fotoUrl: body.fotoUrl || null,
      },
    });

    return NextResponse.json({ ok: true, vehiculo });
  } catch (e) {
    console.error("AkuoSplash transportista/vehiculos POST error:", e);
    return NextResponse.json({ error: "No se pudo crear el vehículo" }, { status: 500 });
  }
}
