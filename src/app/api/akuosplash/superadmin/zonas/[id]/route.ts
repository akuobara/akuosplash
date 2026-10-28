import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/superadmin/zonas/[id] — editar zona
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.nombre !== undefined) data.nombre = body.nombre.trim();
  if (body.descripcion !== undefined) data.descripcion = body.descripcion?.trim() || null;
  if (body.zonaGeoJson !== undefined) data.zonaGeoJson = body.zonaGeoJson;
  if (body.centroLat !== undefined) data.centroLat = body.centroLat ? Number(body.centroLat) : null;
  if (body.centroLng !== undefined) data.centroLng = body.centroLng ? Number(body.centroLng) : null;
  if (body.precioPorLitro !== undefined) data.precioPorLitro = Number(body.precioPorLitro);
  if (body.litrosMinimos !== undefined) data.litrosMinimos = Number(body.litrosMinimos);
  if (body.radioKm !== undefined) data.radioKm = body.radioKm ? Number(body.radioKm) : null;
  if (body.activa !== undefined) data.activa = !!body.activa;
  // Precio dinámico
  if (body.precioMinimoPorLitro !== undefined) data.precioMinimoPorLitro = body.precioMinimoPorLitro != null ? Number(body.precioMinimoPorLitro) : null;
  if (body.precioMinimoTotal !== undefined) data.precioMinimoTotal = body.precioMinimoTotal != null ? Number(body.precioMinimoTotal) : null;
  if (body.precioMaximoPorLitro !== undefined) data.precioMaximoPorLitro = body.precioMaximoPorLitro != null ? Number(body.precioMaximoPorLitro) : null;

  const zona = await akuosplashDb.akuoZona.update({ where: { id }, data });
  return NextResponse.json({ zona });
}

// DELETE /api/akuosplash/superadmin/zonas/[id] — eliminar zona (desactiva)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  try {
    await akuosplashDb.akuoZona.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "No se pudo eliminar" }, { status: 500 });
  }
}
