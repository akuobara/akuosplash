import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/usuarios/[id]/soltar-pedidos
// El chofer suelta todos sus pedidos pendientes (por rango de fechas opcional).
// Body: { fechaInicio?, fechaFin?, soltarClientes?, reemplazoChoferId? }
//   - fechaInicio/fechaFin: rango de pedidos a soltar (por fechaSolicitada). Si omiten, suelta todos los pendientes.
//   - soltarClientes: si true, también se elimina como choferPreferido de todos sus clientes.
//   - reemplazoChoferId: si se pasa, se reasignan los pedidos a este chofer en vez de publicarlos al pool.
//
// El dueño puede llamar esto para cualquier chofer de su organización.
// El chofer solo puede llamarlo para sí mismo.
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

  // Autorización: chofer solo para sí mismo; dueño para cualquier chofer de su organización
  if (session.role === "chofer" && id !== session.userId) {
    return NextResponse.json({ error: "Solo puedes soltar tus propios pedidos" }, { status: 403 });
  }
  if (session.role === "dueno") {
    const target = await db.usuario.findUnique({ where: { id } });
    if (!target || target.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado sobre este usuario" }, { status: 403 });
    }
  }

  // Validar reemplazo si se proporciona
  if (reemplazoChoferId) {
    const reemplazo = await db.usuario.findUnique({
      where: { id: reemplazoChoferId },
      select: { id: true, role: true, activo: true },
    });
    if (!reemplazo || reemplazo.role !== "chofer" || !reemplazo.activo) {
      return NextResponse.json({ error: "El chofer de reemplazo debe ser un chofer activo" }, { status: 400 });
    }
  }

  // Construir filtro de pedidos
  const wherePedido: Record<string, unknown> = {
    duenoId,
    estado: { in: ["pendiente", "programado", "en_ruta"] },
    OR: [
      { choferAsignadoId: id },
      { tomadoPorChoferId: id },
      { prioridadChoferId: id },
      { choferId: id },
    ],
  };

  // Filtro por rango de fechas (fechaSolicitada)
  if (body.fechaInicio || body.fechaFin) {
    const dateFilter: Record<string, unknown> = {};
    if (body.fechaInicio) dateFilter.gte = new Date(body.fechaInicio);
    if (body.fechaFin) dateFilter.lte = new Date(body.fechaFin);
    wherePedido.fechaSolicitada = dateFilter;
  }

  const result = await db.$transaction(async (tx) => {
    let pedidosReasignados = 0;
    let pedidosPublicados = 0;

    if (reemplazoChoferId) {
      // REEMPLAZO: reasignar todos los pedidos al nuevo chofer
      const asignados = await tx.pedido.updateMany({
        where: { ...wherePedido, choferAsignadoId: id },
        data: { choferAsignadoId: reemplazoChoferId },
      });
      pedidosReasignados += asignados.count;

      const tomados = await tx.pedido.updateMany({
        where: { ...wherePedido, tomadoPorChoferId: id },
        data: { tomadoPorChoferId: reemplazoChoferId, choferId: reemplazoChoferId },
      });
      pedidosReasignados += tomados.count;

      const prioridad = await tx.pedido.updateMany({
        where: { ...wherePedido, prioridadChoferId: id },
        data: { prioridadChoferId: reemplazoChoferId, prioridadTipo: "permanente" },
      });
      pedidosReasignados += prioridad.count;

      // Si el pedido estaba en_ruta y lo tenía tomado, mantener en_ruta con el reemplazo
      await tx.pedido.updateMany({
        where: { ...wherePedido, estado: "en_ruta" },
        data: { choferId: reemplazoChoferId },
      });
    } else {
      // SIN REEMPLAZO: limpiar referencias y publicar al pool

      // Limpiar tomadoPorChoferId
      const tomadoUpdate = await tx.pedido.updateMany({
        where: { ...wherePedido, tomadoPorChoferId: id },
        data: { tomadoPorChoferId: null },
      });

      // Limpiar choferAsignadoId
      const asignadoUpdate = await tx.pedido.updateMany({
        where: { ...wherePedido, choferAsignadoId: id },
        data: { choferAsignadoId: null },
      });

      // Limpiar prioridadChoferId
      const prioridadUpdate = await tx.pedido.updateMany({
        where: { ...wherePedido, prioridadChoferId: id },
        data: { prioridadChoferId: null, prioridadTipo: "ninguna" },
      });

      // Volver a "pendiente" si estaba en_ruta
      const enRutaUpdate = await tx.pedido.updateMany({
        where: { ...wherePedido, estado: "en_ruta" },
        data: { estado: "pendiente" },
      });

      // Publicar al pool (asignacionTipo = "publicado")
      const publicadoUpdate = await tx.pedido.updateMany({
        where: { ...wherePedido, asignacionTipo: "manual" },
        data: { asignacionTipo: "publicado", publicadoEn: new Date() },
      });
      pedidosPublicados = publicadoUpdate.count;
    }

    // Si soltarClientes, eliminar (o reemplazar) como choferPreferido
    let clientesSoltados = 0;
    let clientesReemplazados = 0;
    if (body.soltarClientes) {
      if (reemplazoChoferId) {
        const r = await tx.cliente.updateMany({
          where: { choferPreferidoId: id, duenoId },
          data: { choferPreferidoId: reemplazoChoferId },
        });
        clientesReemplazados = r.count;
      } else {
        const r = await tx.cliente.updateMany({
          where: { choferPreferidoId: id, duenoId },
          data: { choferPreferidoId: null },
        });
        clientesSoltados = r.count;
      }
    }

    return {
      pedidosReasignados,
      pedidosPublicados,
      clientesSoltados,
      clientesReemplazados,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
