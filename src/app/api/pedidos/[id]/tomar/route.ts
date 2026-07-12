import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/pedidos/[id]/tomar
// Chofer toma un pedido publicado.
// Reglas:
// - Si el pedido tiene prioridadChoferId != null Y prioridadTipo != "ninguna":
//   - Solo el chofer con prioridad puede tomarlo
//   - EXCEPTO si el chofer con prioridad cede (estado del pedido sigue publicado pero prioridadTipo = "ninguna")
// - Si no hay prioridad, cualquier chofer puede tomarlo
//
// Implementación atómica: usa updateMany con condición tomadoPorChoferId=null para evitar
// race conditions entre dos choferes que intentan tomar el mismo pedido simultáneamente.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "chofer") {
    return NextResponse.json({ error: "Solo choferes pueden tomar pedidos" }, { status: 403 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (pedido.estado === "entregado" || pedido.estado === "cancelado") {
    return NextResponse.json({ error: "Este pedido ya no está disponible" }, { status: 400 });
  }

  // Verificar si ya fue tomado
  if (pedido.tomadoPorChoferId) {
    return NextResponse.json({ error: "Este pedido ya fue tomado por otro chofer" }, { status: 400 });
  }

  // Verificar prioridad
  if (pedido.prioridadChoferId && pedido.prioridadTipo !== "ninguna") {
    if (pedido.prioridadChoferId !== session.userId) {
      // Obtener nombre del chofer preferido para el mensaje
      const choferPrioridad = await db.usuario.findUnique({
        where: { id: pedido.prioridadChoferId },
        select: { nombre: true },
      });
      return NextResponse.json(
        { error: `Este pedido tiene prioridad para ${choferPrioridad?.nombre ?? "otro chofer"}. Debes esperar a que ceda su prioridad.` },
        { status: 403 }
      );
    }
  }

  // Verificar que sea publicable o asignado a él
  if (pedido.asignacionTipo !== "publicado" && pedido.choferAsignadoId !== session.userId) {
    return NextResponse.json({ error: "Este pedido no está disponible para tomar" }, { status: 400 });
  }

  // UPDATE atómico: solo actualiza si tomadoPorChoferId sigue siendo null.
  // Esto previene race conditions: si dos choferes llegan aquí simultáneamente,
  // solo uno obtendrá count=1.
  const nuevoEstado = pedido.estado === "pendiente" ? "en_ruta" : pedido.estado;
  const result = await db.pedido.updateMany({
    where: {
      id,
      tomadoPorChoferId: null,
      estado: { in: ["pendiente", "programado", "en_ruta"] },
    },
    data: {
      tomadoPorChoferId: session.userId,
      choferId: session.userId,
      estado: nuevoEstado,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Este pedido fue tomado por otro chofer justo ahora. Recarga la lista." }, { status: 409 });
  }

  const actualizado = await db.pedido.findUnique({ where: { id } });
  return NextResponse.json({ pedido: actualizado });
}
