import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/superadmin/zonas — lista todas las zonas
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const zonas = await akuosplashDb.akuoZona.findMany({
    where: { activa: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ zonas });
}

// POST /api/akuosplash/superadmin/zonas — crear zona
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  if (!body.nombre?.trim()) return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 });
  if (!body.precioPorLitro || Number(body.precioPorLitro) <= 0) return NextResponse.json({ error: "Precio por litro es obligatorio" }, { status: 400 });

  const zonaGeoJson = body.zonaGeoJson || '{"type":"Polygon","coordinates":[]}';

  const zona = await akuosplashDb.akuoZona.create({
    data: {
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      zonaGeoJson,
      centroLat: body.centroLat ? Number(body.centroLat) : null,
      centroLng: body.centroLng ? Number(body.centroLng) : null,
      precioPorLitro: Number(body.precioPorLitro),
      litrosMinimos: body.litrosMinimos ? Number(body.litrosMinimos) : 1000,
      radioKm: body.radioKm ? Number(body.radioKm) : null,
      activa: body.activa !== false,
      // Precio dinámico (opcional)
      precioMinimoPorLitro: body.precioMinimoPorLitro != null ? Number(body.precioMinimoPorLitro) : null,
      precioMinimoTotal: body.precioMinimoTotal != null ? Number(body.precioMinimoTotal) : null,
      precioMaximoPorLitro: body.precioMaximoPorLitro != null ? Number(body.precioMaximoPorLitro) : null,
    },
  });
  return NextResponse.json({ zona }, { status: 201 });
}
