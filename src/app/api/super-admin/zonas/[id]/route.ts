import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// PATCH /api/super-admin/zonas/[id] — editar zona
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.nombre !== undefined) data.nombre = String(body.nombre).trim();
  if (body.descripcion !== undefined) data.descripcion = body.descripcion ? String(body.descripcion).trim() : null;
  if (body.zonaGeoJson !== undefined) data.zonaGeoJson = body.zonaGeoJson;
  if (body.centroLat !== undefined) data.centroLat = body.centroLat ? Number(body.centroLat) : null;
  if (body.centroLng !== undefined) data.centroLng = body.centroLng ? Number(body.centroLng) : null;
  if (body.precioPorLitro !== undefined) data.precioPorLitro = Number(body.precioPorLitro) || 0;
  if (body.radioKm !== undefined) data.radioKm = body.radioKm ? Number(body.radioKm) : null;
  if (body.activa !== undefined) data.activa = !!body.activa;

  const zona = await db.zona.update({ where: { id }, data });
  return NextResponse.json({ zona });
}

// DELETE /api/super-admin/zonas/[id] — eliminar zona
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  await db.zona.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
