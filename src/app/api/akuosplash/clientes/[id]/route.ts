import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/clientes/[id] — actualizar cliente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const { id } = await params;
  const cliente = await akuosplashDb.akuoCliente.findUnique({ where: { id } });
  if (!cliente || cliente.transportistaId !== user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const body = await req.json();
  const data: any = {};
  if (body.nombre !== undefined) data.nombre = body.nombre.trim();
  if (body.telefono !== undefined) data.telefono = body.telefono || null;
  if (body.direccion !== undefined) data.direccion = body.direccion || null;
  if (body.zona !== undefined) data.zona = body.zona || null;
  if (body.lat !== undefined) data.lat = body.lat ? Number(body.lat) : null;
  if (body.lng !== undefined) data.lng = body.lng ? Number(body.lng) : null;
  if (body.precioEfectivoPorLitro !== undefined) data.precioEfectivoPorLitro = Number(body.precioEfectivoPorLitro) || 0;
  if (body.precioTransferenciaPorLitro !== undefined) data.precioTransferenciaPorLitro = Number(body.precioTransferenciaPorLitro) || 0;
  if (body.nota !== undefined) data.nota = body.nota || null;
  if (body.estanquesJson !== undefined) data.estanquesJson = body.estanquesJson || null;
  if (body.requiereIngresoPropiedad !== undefined) data.requiereIngresoPropiedad = !!body.requiereIngresoPropiedad;
  if (body.entregaDesdeAfuera !== undefined) data.entregaDesdeAfuera = !!body.entregaDesdeAfuera;
  if (body.conexionExterna !== undefined) data.conexionExterna = !!body.conexionExterna;
  if (body.indicacionesAcceso !== undefined) data.indicacionesAcceso = body.indicacionesAcceso || null;

  const actualizado = await akuosplashDb.akuoCliente.update({ where: { id }, data });
  return NextResponse.json({ ok: true, cliente: actualizado });
}

// DELETE /api/akuosplash/clientes/[id] — eliminar (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const { id } = await params;
  const cliente = await akuosplashDb.akuoCliente.findUnique({ where: { id } });
  if (!cliente || cliente.transportistaId !== user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  await akuosplashDb.akuoCliente.update({ where: { id }, data: { activo: false } });
  return NextResponse.json({ ok: true });
}
