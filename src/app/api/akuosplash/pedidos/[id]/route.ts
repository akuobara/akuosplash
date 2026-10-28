import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/pedidos/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  const pedido = await akuosplashDb.akuoPedido.findUnique({ where: { id } });
  if (!pedido || pedido.transportistaId !== user.id) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const body = await req.json();
  const data: any = {};
  if (body.estado !== undefined) data.estado = body.estado;
  if (body.litrosSolicitados !== undefined) data.litrosSolicitados = Number(body.litrosSolicitados);
  if (body.metodoPagoPreferido !== undefined) data.metodoPagoPreferido = body.metodoPagoPreferido;
  if (body.nota !== undefined) data.nota = body.nota || null;
  if (body.fechaSolicitada !== undefined) data.fechaSolicitada = body.fechaSolicitada ? new Date(body.fechaSolicitada) : null;
  const actualizado = await akuosplashDb.akuoPedido.update({ where: { id }, data });
  return NextResponse.json({ ok: true, pedido: actualizado });
}

// DELETE /api/akuosplash/pedidos/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  const pedido = await akuosplashDb.akuoPedido.findUnique({ where: { id } });
  if (!pedido || pedido.transportistaId !== user.id) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await akuosplashDb.akuoPedido.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
