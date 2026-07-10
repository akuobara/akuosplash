import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/camiones — lista todos los camiones. Si no hay ninguno, crea el por defecto.
export async function GET() {
  let camiones = await db.camion.findMany({
    orderBy: { creadoEn: "asc" },
    include: {
      _count: { select: { vueltas: true } },
    },
  });

  // Auto-crear camión por defecto si no existe ninguno
  if (camiones.length === 0) {
    const config = await db.configuracion.findUnique({ where: { id: "default" } });
    const capacidad = config?.capacidadCamion ?? 17000;
    const nuevo = await db.camion.create({
      data: {
        nombre: "Camión principal",
        capacidad,
        activo: true,
      },
      include: { _count: { select: { vueltas: true } } },
    });
    camiones = [nuevo];
  }

  return NextResponse.json({ camiones });
}

// POST /api/camiones — crear un nuevo camión
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    const capacidad = Number(body.capacidad) || 0;
    if (capacidad <= 0) {
      return NextResponse.json({ error: "La capacidad debe ser mayor a 0" }, { status: 400 });
    }

    const nuevo = await db.camion.create({
      data: {
        nombre: body.nombre.trim(),
        patente: body.patente?.trim() || null,
        capacidad,
        activo: body.activo !== false,
      },
      include: { _count: { select: { vueltas: true } } },
    });

    return NextResponse.json({ camion: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el camión" }, { status: 500 });
  }
}
