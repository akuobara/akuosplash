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
  if (body.marca !== undefined) data.marca = body.marca || null;
  if (body.modelo !== undefined) data.modelo = body.modelo || null;
  if (body.año !== undefined) data.año = body.año ? Number(body.año) : null;
  if (body.activo !== undefined) data.activo = !!body.activo;
  // Documentos
  if (body.permisoCircUrl !== undefined) data.permisoCircUrl = body.permisoCircUrl || null;
  if (body.revisionTecUrl !== undefined) data.revisionTecUrl = body.revisionTecUrl || null;
  if (body.seguroUrl !== undefined) data.seguroUrl = body.seguroUrl || null;
  // Fotos del vehículo
  if (body.fotoFrenteUrl !== undefined) data.fotoFrenteUrl = body.fotoFrenteUrl || null;
  if (body.fotoAtrasUrl !== undefined) data.fotoAtrasUrl = body.fotoAtrasUrl || null;
  if (body.fotoDerechaUrl !== undefined) data.fotoDerechaUrl = body.fotoDerechaUrl || null;
  if (body.fotoIzquierdaUrl !== undefined) data.fotoIzquierdaUrl = body.fotoIzquierdaUrl || null;
  // Si se modifican documentos, resetear verificación
  if (body.permisoCircUrl !== undefined || body.revisionTecUrl !== undefined || body.seguroUrl !== undefined) {
    data.documentosVerificados = false;
    data.verificadoEn = null;
    data.verificadoPor = null;
  }
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
