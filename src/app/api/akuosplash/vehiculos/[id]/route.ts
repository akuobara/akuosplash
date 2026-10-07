import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/vehiculos/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const { id } = await params;
  const veh = await akuosplashDb.akuoVehiculo.findUnique({ where: { id } });
  if (!veh || veh.transportistaId !== user.id) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const body = await req.json();
  const data: any = {};
  if (body.patente !== undefined) data.patente = body.patente;
  if (body.tipo !== undefined) data.tipo = body.tipo;
  if (body.capacidad !== undefined) data.capacidadLitros = Number(body.capacidad);
  if (body.marca !== undefined) data.marca = body.marca;
  if (body.modelo !== undefined) data.modelo = body.modelo;
  if (body.activo !== undefined) data.activo = !!body.activo;
  await akuosplashDb.akuoVehiculo.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/akuosplash/vehiculos/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const { id } = await params;
  const veh = await akuosplashDb.akuoVehiculo.findUnique({ where: { id } });
  if (!veh || veh.transportistaId !== user.id) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await akuosplashDb.akuoVehiculo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
