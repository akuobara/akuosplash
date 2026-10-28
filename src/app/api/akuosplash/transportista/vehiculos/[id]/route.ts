// PATCH /api/akuosplash/transportista/vehiculos/[id] — edita vehículo
// DELETE /api/akuosplash/transportista/vehiculos/[id] — elimina (o desactiva) vehículo
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const { id } = await params;

  const existente = await akuosplashDb.akuoVehiculo.findUnique({ where: { id } });
  if (!existente || existente.transportistaId !== user.id) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    const campos = [
      "patente",
      "tipo",
      "capacidadLitros",
      "marca",
      "modelo",
      "año",
      "permisoCircUrl",
      "revisionTecUrl",
      "seguroUrl",
      "fotoUrl",
      "activo",
    ];
    for (const c of campos) {
      if (c in body) {
        if (typeof body[c] === "string" && body[c].trim() === "") {
          data[c] = null;
        } else if (body[c] !== undefined && body[c] !== null) {
          data[c] = c === "capacidadLitros" || c === "año" ? Number(body[c]) : body[c];
        } else {
          data[c] = null;
        }
      }
    }
    if (data.patente && typeof data.patente === "string") {
      data.patente = (data.patente as string).toUpperCase().trim();
    }
    if (data.tipo && !["aljibe", "tolva", "cerrado", "plano"].includes(data.tipo as string)) {
      return NextResponse.json({ error: "Tipo de vehículo inválido" }, { status: 400 });
    }

    const actualizado = await akuosplashDb.akuoVehiculo.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true, vehiculo: actualizado });
  } catch (e) {
    console.error("AkuoSplash vehiculo PATCH error:", e);
    return NextResponse.json({ error: "No se pudo actualizar el vehículo" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const { id } = await params;
  const existente = await akuosplashDb.akuoVehiculo.findUnique({ where: { id } });
  if (!existente || existente.transportistaId !== user.id) {
    return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
  }
  // Verificar que no tenga entregas asociadas — si las tiene, solo desactivar
  const entregasAsoc = await akuosplashDb.akuoEntrega.count({
    where: { vehiculoId: id },
  });
  if (entregasAsoc > 0) {
    const actualizado = await akuosplashDb.akuoVehiculo.update({
      where: { id },
      data: { activo: false },
    });
    return NextResponse.json({
      ok: true,
      vehiculo: actualizado,
      mensaje: "Vehículo desactivado (tenía entregas asociadas, no se eliminó)",
    });
  }
  await akuosplashDb.akuoVehiculo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
