import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/entregas/[id] — actualizar entrega
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  const entrega = await akuosplashDb.akuoEntrega.findUnique({ where: { id } });
  if (!entrega || entrega.transportistaId !== user.id) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const body = await req.json();
  const data: any = {};
  if (body.litros !== undefined) data.litros = Number(body.litros);
  if (body.total !== undefined) data.total = Number(body.total);
  if (body.montoEfectivo !== undefined) data.montoEfectivo = Number(body.montoEfectivo);
  if (body.montoTransferencia !== undefined) data.montoTransferencia = Number(body.montoTransferencia);
  if (body.montoRecibido !== undefined) data.montoRecibido = Number(body.montoRecibido);
  if (body.metodoPago !== undefined) data.metodoPago = body.metodoPago;
  if (body.estadoPago !== undefined) data.estadoPago = body.estadoPago;
  if (body.nota !== undefined) data.nota = body.nota || null;
  if (body.fotoMedidorUrl !== undefined) data.fotoMedidorUrl = body.fotoMedidorUrl;
  if (body.lecturaAnterior !== undefined) data.lecturaAnterior = body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null;
  if (body.lecturaActual !== undefined) data.lecturaActual = body.lecturaActual != null ? Number(body.lecturaActual) : null;
  if (body.detalleEstanquesJson !== undefined) data.detalleEstanquesJson = body.detalleEstanquesJson;
  const actualizado = await akuosplashDb.akuoEntrega.update({ where: { id }, data });
  return NextResponse.json({ ok: true, entrega: actualizado });
}

// DELETE /api/akuosplash/entregas/[id] — eliminar entrega
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  const entrega = await akuosplashDb.akuoEntrega.findUnique({ where: { id } });
  if (!entrega || entrega.transportistaId !== user.id) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  await akuosplashDb.akuoEntrega.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
