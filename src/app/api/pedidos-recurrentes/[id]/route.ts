import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// PATCH /api/pedidos-recurrentes/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const recurrente = await db.pedidoRecurrente.findUnique({ where: { id } });
  if (!recurrente || recurrente.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.litrosSolicitados !== undefined) data.litrosSolicitados = Number(body.litrosSolicitados) || 0;
  if (body.metodoPagoPreferido !== undefined) data.metodoPagoPreferido = body.metodoPagoPreferido;
  if (body.nota !== undefined) data.nota = body.nota?.trim() || null;
  if (body.frecuenciaDias !== undefined) data.frecuenciaDias = Number(body.frecuenciaDias) || 1;
  if (body.activo !== undefined) data.activo = !!body.activo;
  if (body.asignacionTipo !== undefined) data.asignacionTipo = body.asignacionTipo;
  if (body.choferAsignadoId !== undefined) data.choferAsignadoId = (body.choferAsignadoId && body.choferAsignadoId !== "__ninguno") ? body.choferAsignadoId : null;
  if (body.fechaProximaGeneracion !== undefined) {
    data.fechaProximaGeneracion = body.fechaProximaGeneracion ? new Date(body.fechaProximaGeneracion) : undefined;
  }

  const actualizado = await db.pedidoRecurrente.update({ where: { id }, data });
  return NextResponse.json({ recurrente: actualizado });
}

// DELETE /api/pedidos-recurrentes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;

  const recurrente = await db.pedidoRecurrente.findUnique({ where: { id } });
  if (!recurrente || recurrente.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await db.pedidoRecurrente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
