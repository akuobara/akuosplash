import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/configuracion  — crea el registro por defecto si no existe
export async function GET() {
  let config = await db.configuracion.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await db.configuracion.create({ data: { id: "default" } });
  }
  return NextResponse.json({ configuracion: config });
}

// PUT /api/configuracion
export async function PUT(req: NextRequest) {
  const body = await req.json();

  // Upsert para que nunca falle si el registro no existe
  const config = await db.configuracion.upsert({
    where: { id: "default" },
    update: {
      ...(body.nombreChofer !== undefined && { nombreChofer: body.nombreChofer.trim() }),
      ...(body.nombreDueno !== undefined && { nombreDueno: body.nombreDueno.trim() }),
      ...(body.porcentajeComisionChofer !== undefined && { porcentajeComisionChofer: Number(body.porcentajeComisionChofer) }),
      ...(body.porcentajeComisionDueno !== undefined && { porcentajeComisionDueno: Number(body.porcentajeComisionDueno) }),
      ...(body.precioPorLitroDefault !== undefined && { precioPorLitroDefault: Number(body.precioPorLitroDefault) }),
    },
    create: {
      id: "default",
      nombreChofer: body.nombreChofer?.trim() || "Chofer",
      nombreDueno: body.nombreDueno?.trim() || "Dueño del Camión",
      porcentajeComisionChofer: Number(body.porcentajeComisionChofer) || 50,
      porcentajeComisionDueno: Number(body.porcentajeComisionDueno) || 50,
      precioPorLitroDefault: Number(body.precioPorLitroDefault) || 0,
    },
  });

  return NextResponse.json({ configuracion: config });
}
