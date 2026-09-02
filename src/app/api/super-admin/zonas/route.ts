import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/zonas — lista todas las zonas
export async function GET() {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const zonas = await db.zona.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { pedidosApp: true, clientesApp: true } } },
  });
  return NextResponse.json({ zonas });
}

// POST /api/super-admin/zonas — crear zona
export async function POST(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 });
  }
  if (!body.precioPorLitro || Number(body.precioPorLitro) <= 0) {
    return NextResponse.json({ error: "Precio por litro es obligatorio" }, { status: 400 });
  }

  // zonaGeoJson puede venir como poligono o usar centroLat/centroLng + radioKm
  let zonaGeoJson = body.zonaGeoJson || '{"type":"Polygon","coordinates":[]}';

  const zona = await db.zona.create({
    data: {
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      zonaGeoJson,
      centroLat: body.centroLat ? Number(body.centroLat) : null,
      centroLng: body.centroLng ? Number(body.centroLng) : null,
      precioPorLitro: Number(body.precioPorLitro),
      radioKm: body.radioKm ? Number(body.radioKm) : null,
      activa: body.activa !== false,
    },
  });
  return NextResponse.json({ zona }, { status: 201 });
}
