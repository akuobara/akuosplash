import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

// PATCH /api/akuosplash/admin/regiones-comunas/[comunaCode]/sub-zonas/[id]
// Actualiza una sub-zona existente.
// Body: { sector?, tipoSector?, centroLat?, centroLng?, radioKm?, precioPorLitro?, litrosMinimos?, activa? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ comunaCode: string; id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const ahora = new Date().toISOString();

  // Construir SET dinámicamente con los campos que vienen en el body
  const setParts: string[] = ["actualizadoEn = ?"];
  const values: any[] = [ahora];

  if (body.sector != null) {
    setParts.push("nombre = ?", "sector = ?");
    values.push(body.sector.trim(), body.sector.trim());
  }
  if (body.tipoSector != null) {
    setParts.push("tipoSector = ?");
    values.push(body.tipoSector);
  }
  if (typeof body.centroLat === "number") {
    setParts.push("centroLat = ?");
    values.push(body.centroLat);
  }
  if (typeof body.centroLng === "number") {
    setParts.push("centroLng = ?");
    values.push(body.centroLng);
  }
  if (typeof body.radioKm === "number") {
    setParts.push("radioKm = ?");
    values.push(body.radioKm);
  }
  if (typeof body.precioPorLitro === "number") {
    setParts.push("precioPorLitro = ?");
    values.push(body.precioPorLitro);
  }
  if (typeof body.litrosMinimos === "number") {
    setParts.push("litrosMinimos = ?");
    values.push(body.litrosMinimos);
  }
  if (typeof body.activa === "boolean") {
    setParts.push("activa = ?");
    values.push(body.activa ? 1 : 0);
  }

  values.push(id);

  try {
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoZona SET ${setParts.join(", ")} WHERE id = ?`,
      ...values
    );
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo actualizar" }, { status: 500 });
  }
}
