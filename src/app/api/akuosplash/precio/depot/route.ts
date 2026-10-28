import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/precio/depot
// PUT /api/akuosplash/precio/depot  body: { lat, lng, nombre? }
// Solo superadmin.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }
  const config = await akuosplashDb.akuoConfig.findFirst();
  return NextResponse.json({
    depotLat: config?.depotLat ?? null,
    depotLng: config?.depotLng ?? null,
    depotNombre: config?.depotNombre ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }
  const body = await req.json();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "Lat/lng inválidas" }, { status: 400 });
  }
  const nombre = typeof body.nombre === "string" ? body.nombre : null;

  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) {
    await akuosplashDb.akuoConfig.create({
      data: {
        depotLat: lat,
        depotLng: lng,
        depotNombre: nombre,
      },
    });
  } else {
    await akuosplashDb.akuoConfig.update({
      where: { id: config.id },
      data: {
        depotLat: lat,
        depotLng: lng,
        depotNombre: nombre,
      },
    });
  }
  return NextResponse.json({ ok: true, depotLat: lat, depotLng: lng, depotNombre: nombre });
}
