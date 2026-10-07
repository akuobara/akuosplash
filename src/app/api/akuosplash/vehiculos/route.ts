import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/vehiculos — lista de vehículos del transportista
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
    where: { transportistaId: user.id },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({
    camiones: vehiculos.map(v => ({
      id: v.id,
      nombre: `${v.marca || ""} ${v.modelo || ""}`.trim() || v.patente || "Vehículo",
      patente: v.patente,
      capacidad: v.capacidadLitros,
      activo: v.activo,
    })),
  });
}

// POST /api/akuosplash/vehiculos — crear nuevo vehículo
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const body = await req.json();
  if (!body.patente?.trim()) return NextResponse.json({ error: "Patente obligatoria" }, { status: 400 });
  const vehiculo = await akuosplashDb.akuoVehiculo.create({
    data: {
      transportistaId: user.id,
      patente: body.patente.trim(),
      tipo: body.tipo || "aljibe",
      capacidadLitros: Number(body.capacidad) || 5000,
      marca: body.marca || null,
      modelo: body.modelo || null,
      año: body.año ? Number(body.año) : null,
      activo: true,
    },
  });
  return NextResponse.json({ ok: true, camion: { id: vehiculo.id, nombre: vehiculo.patente, patente: vehiculo.patente, capacidad: vehiculo.capacidadLitros, activo: vehiculo.activo } }, { status: 201 });
}
