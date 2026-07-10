import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/pedidos/[id]/ceder
// Chofer con prioridad cede su prioridad para este pedido (queda disponible para otros)
// Body opcional: { permanente: false } — si true, también quita el choferPreferido del cliente
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

  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Quién puede ceder:
  // - El chofer que tiene la prioridad (prioridadChoferId = su id)
  // - El dueño (puede ceder la prioridad de cualquier chofer)
  if (session.role === "chofer" && pedido.prioridadChoferId !== session.userId) {
    return NextResponse.json({ error: "Solo puedes ceder tu propia prioridad" }, { status: 403 });
  }

  // Quitar prioridad del pedido
  const actualizado = await db.pedido.update({
    where: { id },
    data: {
      prioridadChoferId: null,
      prioridadTipo: "ninguna",
    },
  });

  // Si pidió ceder permanente, también quitar choferPreferido del cliente
  if (body.permanente && pedido.clienteId && session.role === "chofer") {
    await db.cliente.update({
      where: { id: pedido.clienteId },
      data: { choferPreferidoId: null },
    });
  }

  return NextResponse.json({ pedido: actualizado });
}
