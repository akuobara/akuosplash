import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/clientes/[id]/soltar-chofer
// El chofer preferido se elimina a sí mismo de este cliente.
// También puede ser usado por el dueño para quitar el chofer preferido.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente || cliente.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Chofer: solo puede soltar si él es el chofer preferido
  if (session.role === "chofer" && cliente.choferPreferidoId !== session.userId) {
    return NextResponse.json({ error: "No eres el chofer preferido de este cliente" }, { status: 403 });
  }

  // Limpiar choferPreferidoId y prioridadChoferId en pedidos pendientes
  await db.$transaction(async (tx) => {
    await tx.cliente.update({
      where: { id },
      data: { choferPreferidoId: null },
    });
    // Limpiar prioridad en pedidos pendientes de este cliente
    await tx.pedido.updateMany({
      where: {
        clienteId: id,
        estado: { in: ["pendiente", "programado"] },
        prioridadChoferId: session.userId,
      },
      data: { prioridadChoferId: null, prioridadTipo: "ninguna" },
    });
  });

  return NextResponse.json({ ok: true });
}
