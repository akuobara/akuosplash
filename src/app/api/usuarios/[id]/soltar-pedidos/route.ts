import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/usuarios/[id]/soltar-pedidos
// El chofer suelta todos sus pedidos pendientes (por rango de fechas opcional).
// Body: { fechaInicio?: string, fechaFin?: string, soltarClientes?: boolean }
//   - fechaInicio/fechaFin: rango de pedidos a soltar (por fechaSolicitada). Si omiten, suelta todos los pendientes.
//   - soltarClientes: si true, también se elimina como choferPreferido de todos sus clientes.
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
    // 1. Limpiar prioridadChoferId en pedidos pendientes
    const prioridadUpdate = await tx.pedido.updateMany({
      where: { ...wherePedido, prioridadChoferId: id },
      data: { prioridadChoferId: null, prioridadTipo: "ninguna" },
    });

    // 2. Limpiar tomadoPorChoferId (volver a publicado si aplica)
    const tomadoUpdate = await tx.pedido.updateMany({
      where: { ...wherePedido, tomadoPorChoferId: id },
      data: { tomadoPorChoferId: null },
    });

    // 3. Limpiar choferAsignadoId
    const asignadoUpdate = await tx.pedido.updateMany({
      where: { ...wherePedido, choferAsignadoId: id },
      data: { choferAsignadoId: null },
    });

    // 4. Si el pedido estaba "en_ruta" y era tomado por este chofer, volver a "pendiente"
    const enRutaUpdate = await tx.pedido.updateMany({
      where: {
        ...wherePedido,
        tomadoPorChoferId: null, // ya limpiado arriba, pero por si acaso
        estado: "en_ruta",
        choferId: id,
      },
      data: { estado: "pendiente" },
    });

    // 5. Si soltarClientes, eliminar como choferPreferido
    let clientesUpdate = { count: 0 };
    if (body.soltarClientes) {
      clientesUpdate = await tx.cliente.updateMany({
        where: { choferPreferidoId: id, duenoId },
        data: { choferPreferidoId: null },
      });
    }

    return {
      pedidosPrioridad: prioridadUpdate.count,
      pedidosTomados: tomadoUpdate.count,
      pedidosAsignados: asignadoUpdate.count,
      pedidosEnRuta: enRutaUpdate.count,
      clientesSoltados: clientesUpdate.count,
    };
  });

  return NextResponse.json({ ok: true, ...result });
}
