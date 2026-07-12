import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/clientes/[id]/soltar-chofer
// El chofer preferido se elimina a sí mismo de este cliente.
// El dueño también puede usarlo.
// Body opcional: { reemplazoChoferId?: string }
//   - Si se pasa reemplazoChoferId, se asigna ese chofer como nuevo preferido.
//   - Si no se pasa, se deja sin chofer preferido y los pedidos pendientes se publican al pool.
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
  const reemplazoChoferId = body.reemplazoChoferId || null;

  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente || cliente.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Chofer: solo puede soltar si él es el chofer preferido
  if (session.role === "chofer" && cliente.choferPreferidoId !== session.userId) {
    return NextResponse.json({ error: "No eres el chofer preferido de este cliente" }, { status: 403 });
  }

  // Validar reemplazo si se proporciona
  if (reemplazoChoferId) {
    const reemplazo = await db.usuario.findUnique({
      where: { id: reemplazoChoferId },
      select: { id: true, role: true, duenoId: true, activo: true },
    });
    if (!reemplazo) {
      return NextResponse.json({ error: "Chofer de reemplazo no encontrado" }, { status: 404 });
    }
    if (reemplazo.role !== "chofer" || !reemplazo.activo) {
      return NextResponse.json({ error: "El reemplazo debe ser un chofer activo" }, { status: 400 });
    }
    // El reemplazo puede ser de la misma flota (duenoId === duenoId) o de otra flota
    // (en cuyo caso los choferes de la misma flota tendrán prioridad al tomar el pedido)
  }

  await db.$transaction(async (tx) => {
    if (reemplazoChoferId) {
      // Asignar reemplazo como nuevo chofer preferido
      await tx.cliente.update({
        where: { id },
        data: { choferPreferidoId: reemplazoChoferId },
      });
      // Actualizar prioridad en pedidos pendientes: ahora el reemplazo tiene prioridad
      await tx.pedido.updateMany({
        where: {
          clienteId: id,
          estado: { in: ["pendiente", "programado"] },
        },
        data: {
          prioridadChoferId: reemplazoChoferId,
          prioridadTipo: "permanente",
        },
      });
    } else {
      // Sin reemplazo: dejar sin chofer preferido
      await tx.cliente.update({
        where: { id },
        data: { choferPreferidoId: null },
      });
      // Limpiar prioridad en pedidos pendientes y publicarlos al pool
      // (asignacionTipo = "publicado" para que cualquier chofer pueda tomarlos)
      await tx.pedido.updateMany({
        where: {
          clienteId: id,
          estado: { in: ["pendiente", "programado"] },
          prioridadChoferId: session.userId,
        },
        data: {
          prioridadChoferId: null,
          prioridadTipo: "ninguna",
        },
      });
      // Publicar pedidos pendientes al pool (visible para todos los choferes)
      await tx.pedido.updateMany({
        where: {
          clienteId: id,
          estado: { in: ["pendiente", "programado"] },
          asignacionTipo: "manual",
        },
        data: {
          asignacionTipo: "publicado",
          publicadoEn: new Date(),
        },
      });
    }
  });

  return NextResponse.json({
    ok: true,
    reemplazo: reemplazoChoferId ? true : false,
    publicado: reemplazoChoferId ? false : true,
  });
}
