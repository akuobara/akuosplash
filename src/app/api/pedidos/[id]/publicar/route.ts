import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/pedidos/[id]/publicar
// Solo dueño. Cambia asignacionTipo a "publicado" y limpia choferAsignadoId.
// El pedido queda disponible para que cualquier chofer lo tome.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo dueños pueden publicar pedidos" }, { status: 403 });
  }

  const { id } = await params;

  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (pedido.estado === "entregado" || pedido.estado === "cancelado") {
    return NextResponse.json({ error: "No se puede publicar un pedido entregado/cancelado" }, { status: 400 });
  }

  const actualizado = await db.pedido.update({
    where: { id },
    data: {
      asignacionTipo: "publicado",
      choferAsignadoId: null,
      tomadoPorChoferId: null,
      publicadoEn: new Date(),
    },
  });

  return NextResponse.json({ pedido: actualizado });
}
