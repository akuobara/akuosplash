import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/pedidos-recurrentes/[id] — editar
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.litrosSolicitados !== undefined) data.litrosSolicitados = Number(body.litrosSolicitados);
  if (body.metodoPagoPreferido !== undefined) data.metodoPagoPreferido = body.metodoPagoPreferido;
  if (body.nota !== undefined) data.nota = body.nota || null;
  if (body.frecuenciaDias !== undefined) data.frecuenciaDias = Number(body.frecuenciaDias);
  if (body.fechaProximaGeneracion !== undefined) data.fechaProximaGeneracion = new Date(body.fechaProximaGeneracion);
  if (body.activo !== undefined) data.activo = !!body.activo;
  if (body.diaSemanaPreferido !== undefined) data.diaSemanaPreferido = body.diaSemanaPreferido != null ? Number(body.diaSemanaPreferido) : null;
  if (body.asignacionTipo !== undefined) data.asignacionTipo = body.asignacionTipo;
  
  try {
    const updated = await akuosplashDb.akuoPedidoRecurrente.update({ where: { id }, data });
    return NextResponse.json({ ok: true, pedidoRecurrente: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo editar" }, { status: 500 });
  }
}

// DELETE /api/akuosplash/pedidos-recurrentes/[id] — eliminar
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  
  const { id } = await params;
  try {
    await akuosplashDb.akuoPedidoRecurrente.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo eliminar" }, { status: 500 });
  }
}
