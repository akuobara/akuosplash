// PATCH /api/akuosplash/transportista/clientes/[id] — edita cliente
// DELETE /api/akuosplash/transportista/clientes/[id] — elimina (o desactiva) cliente
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

  const existente = await akuosplashDb.akuoCliente.findUnique({ where: { id } });
  if (!existente || existente.transportistaId !== user.id) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};
    const camposString = [
      "nombre",
      "telefono",
      "direccion",
      "zona",
      "nota",
      "estanquesJson",
      "indicacionesAcceso",
    ];
    for (const c of camposString) {
      if (c in body) {
        if (typeof body[c] === "string" && body[c].trim() === "") {
          data[c] = null;
        } else if (body[c] !== undefined && body[c] !== null) {
          data[c] = (body[c] as string).trim();
        } else {
          data[c] = null;
        }
      }
    }
    const camposNumber = ["lat", "lng", "precioEfectivoPorLitro", "precioTransferenciaPorLitro"];
    for (const c of camposNumber) {
      if (c in body && body[c] !== null && body[c] !== undefined && body[c] !== "") {
        data[c] = Number(body[c]);
      } else if (c in body) {
        data[c] = c.startsWith("precio") ? 0 : null;
      }
    }
    const camposBool = ["requiereIngresoPropiedad", "entregaDesdeAfuera", "conexionExterna", "activo"];
    for (const c of camposBool) {
      if (c in body) data[c] = !!body[c];
    }

    const actualizado = await akuosplashDb.akuoCliente.update({
      where: { id },
      data,
    });
    return NextResponse.json({ ok: true, cliente: actualizado });
  } catch (e) {
    console.error("AkuoSplash cliente PATCH error:", e);
    return NextResponse.json({ error: "No se pudo actualizar el cliente" }, { status: 500 });
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
  const existente = await akuosplashDb.akuoCliente.findUnique({ where: { id } });
  if (!existente || existente.transportistaId !== user.id) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }
  // Si tiene entregas, solo desactivar
  const entregasAsoc = await akuosplashDb.akuoEntrega.count({
    where: { clienteId: id },
  });
  if (entregasAsoc > 0) {
    const actualizado = await akuosplashDb.akuoCliente.update({
      where: { id },
      data: { activo: false },
    });
    return NextResponse.json({
      ok: true,
      cliente: actualizado,
      mensaje: "Cliente desactivado (tenía entregas asociadas)",
    });
  }
  await akuosplashDb.akuoCliente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
