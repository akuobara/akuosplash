import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { parseDateTimeLocalInput } from "@/lib/helpers";

// PATCH /api/pedidos/[id]
// Choferes solo pueden editar pedidos asignados a ellos, que crearon, o que tomaron.
// Solo el dueño puede cambiar asignación, prioridad, o estado.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
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

  // Chofer: verificar que tiene relación con el pedido
  if (session.role === "chofer") {
    const esSuPedido =
      pedido.choferAsignadoId === session.userId ||
      pedido.tomadoPorChoferId === session.userId ||
      pedido.choferId === session.userId;
    if (!esSuPedido) {
      return NextResponse.json({ error: "No tienes permiso para editar este pedido" }, { status: 403 });
    }
  }

  const body = await req.json();

  // Choferes no pueden cambiar asignación, prioridad, ni marcar como entregado.
  // Sí pueden marcar como programado o cancelado (sus propios pedidos).
  if (session.role === "chofer") {
    delete body.asignacionTipo;
    delete body.choferAsignadoId;
    delete body.prioridadChoferId;
    delete body.prioridadTipo;
    // Solo bloquear "entregado" — programado y cancelado son permitidos
    if (body.estado === "entregado") {
      delete body.estado;
    }
  }

  const actualizado = await db.pedido.update({
    where: { id },
    data: {
      ...(body.clienteNombre !== undefined && { clienteNombre: body.clienteNombre.trim() }),
      ...(body.clienteDireccion !== undefined && { clienteDireccion: body.clienteDireccion?.trim() || null }),
      ...(body.clienteTelefono !== undefined && { clienteTelefono: body.clienteTelefono?.trim() || null }),
      ...(body.clienteZona !== undefined && { clienteZona: body.clienteZona?.trim() || null }),
      ...(body.clienteLat !== undefined && { clienteLat: body.clienteLat === null || body.clienteLat === "" ? null : Number(body.clienteLat) }),
      ...(body.clienteLng !== undefined && { clienteLng: body.clienteLng === null || body.clienteLng === "" ? null : Number(body.clienteLng) }),
      ...(body.litrosSolicitados !== undefined && { litrosSolicitados: Number(body.litrosSolicitados) || 0 }),
      ...(body.fechaSolicitada !== undefined && { fechaSolicitada: body.fechaSolicitada ? parseDateTimeLocalInput(body.fechaSolicitada) : null }),
      ...(body.metodoPagoPreferido !== undefined && { metodoPagoPreferido: body.metodoPagoPreferido }),
      ...(body.indicacionesAcceso !== undefined && { indicacionesAcceso: body.indicacionesAcceso?.trim() || null }),
      ...(body.nota !== undefined && { nota: body.nota?.trim() || null }),
      ...(body.estado !== undefined && { estado: body.estado }),
      ...(body.vueltaId !== undefined && { vueltaId: body.vueltaId || null }),
      ...(body.asignacionTipo !== undefined && { asignacionTipo: body.asignacionTipo }),
      ...(body.choferAsignadoId !== undefined && { choferAsignadoId: (body.choferAsignadoId && body.choferAsignadoId !== "__ninguno") ? body.choferAsignadoId : null }),
      ...(body.prioridadChoferId !== undefined && { prioridadChoferId: (body.prioridadChoferId && body.prioridadChoferId !== "__ninguno") ? body.prioridadChoferId : null }),
      ...(body.prioridadTipo !== undefined && { prioridadTipo: body.prioridadTipo }),
    },
  });

  return NextResponse.json({ pedido: actualizado });
}

// DELETE /api/pedidos/[id] — solo dueño puede borrar
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo el dueño puede eliminar pedidos" }, { status: 403 });
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

  // No borrar si ya fue entregado (preservar historial)
  if (pedido.estado === "entregado") {
    return NextResponse.json(
      { error: "No se puede eliminar un pedido ya entregado. Cáncélalo en su lugar." },
      { status: 400 }
    );
  }

  await db.pedido.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
