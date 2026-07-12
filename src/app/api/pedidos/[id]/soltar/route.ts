import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/pedidos/[id]/soltar
// El chofer suelta un pedido individual (limpia su prioridadChoferId y tomadoPorChoferId).
// Body opcional: { soloPrioridad: boolean } — si true, solo limpia prioridad (mantiene tomado).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const soloPrioridad = body.soloPrioridad === true;

  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (pedido.estado === "entregado") {
    return NextResponse.json({ error: "No se puede soltar un pedido ya entregado" }, { status: 400 });
  }

  // Verificar que el chofer tiene relación con el pedido
  const esSuPedido =
    pedido.choferAsignadoId === session.userId ||
    pedido.tomadoPorChoferId === session.userId ||
    pedido.prioridadChoferId === session.userId ||
    pedido.choferId === session.userId;

  if (session.role === "chofer" && !esSuPedido) {
    return NextResponse.json({ error: "No tienes relación con este pedido" }, { status: 403 });
  }

  // Limpiar referencias del chofer en este pedido
  const data: Record<string, unknown> = {};
  if (pedido.prioridadChoferId === session.userId) {
    data.prioridadChoferId = null;
    data.prioridadTipo = "ninguna";
  }
  if (!soloPrioridad) {
    if (pedido.tomadoPorChoferId === session.userId) {
      data.tomadoPorChoferId = null;
    }
    if (pedido.choferAsignadoId === session.userId) {
      data.choferAsignadoId = null;
    }
    // Si era publicado y lo tomó, volver a publicado
    if (pedido.asignacionTipo === "publicado" && pedido.tomadoPorChoferId === session.userId) {
      data.estado = pedido.estado === "en_ruta" ? "pendiente" : pedido.estado;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, message: "No había nada que soltar" });
  }

  await db.pedido.update({ where: { id }, data });

  return NextResponse.json({ ok: true });
}
