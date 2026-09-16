import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/vueltas/[id]/cerrar
//
// Cierra la vuelta y, si algún pedido quedó con más de 1000 L pendientes
// (pidió más de lo que se entregó en esta vuelta), crea automáticamente
// un nuevo pedido para lo que falta.
//
// Response:
//   {
//     ok: true,
//     vuelta: {...},
//     pedidosReagendados: [
//       { cliente: "Milko", litrosPendientes: 11000, nuevoPedidoId: "..." }
//     ]
//   }
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const vuelta = await db.vuelta.findUnique({ where: { id } });
  if (!vuelta || vuelta.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // Solo el chofer que inició la vuelta puede cerrarla
  if (vuelta.choferId !== session.userId) {
    return NextResponse.json(
      { error: "Solo el chofer que inició esta vuelta puede cerrarla" },
      { status: 403 }
    );
  }

  const actualizada = await db.vuelta.update({
    where: { id },
    data: { activa: false, cerradaEn: new Date() },
  });

  // === REAGENDAR PEDIDOS INCOMPLETOS ===
  // Buscar todos los pedidos que tengan una entrega en esta vuelta.
  // La relación es Pedido.entregaId → Entrega.id (no Entrega.pedidoId).
  // Para cada entrega de esta vuelta, buscar si hay un pedido con entregaId = entrega.id.
  const entregasDeLaVuelta = await db.entrega.findMany({
    where: { vueltaId: id },
    select: {
      id: true,
      litros: true,
      clienteId: true,
      clienteNombre: true,
    },
  });

  const pedidosReagendados: Array<{
    cliente: string;
    litrosPendientes: number;
    litrosSolicitados: number;
    litrosEntregados: number;
    nuevoPedidoId: string;
    pedidoOriginalId: string;
  }> = [];

  for (const entrega of entregasDeLaVuelta) {
    // Buscar el pedido vinculado a esta entrega
    const pedidoOriginal = await db.pedido.findFirst({
      where: { entregaId: entrega.id },
      select: {
        id: true,
        litrosSolicitados: true,
        clienteId: true,
        clienteNombre: true,
        clienteDireccion: true,
        clienteTelefono: true,
        clienteZona: true,
        clienteLat: true,
        clienteLng: true,
        metodoPagoPreferido: true,
        indicacionesAcceso: true,
        nota: true,
        asignacionTipo: true,
        choferAsignadoId: true,
        franjaHoraria: true,
        pedidoRecurrenteId: true,
      },
    });
    if (!pedidoOriginal) continue;

    // Sumar TODAS las entregas de esta vuelta para el mismo cliente+pedido
    // (puede haber más de una entrega si se hizo en partes)
    // Como el pedido tiene entregaId único, una sola entrega por pedido.
    // Pero podría haber otras entregas del mismo cliente en esta vuelta sin pedidoId.
    // Para simplificar: usar el litros de esta entrega.
    const litrosEntregadosTotal = entrega.litros;
    const litrosPendientes = pedidoOriginal.litrosSolicitados - litrosEntregadosTotal;

    // Si quedan más de 1000 L pendientes, crear un nuevo pedido
    if (litrosPendientes > 1000) {
      // Marcar el pedido original como "entregado" (parcialmente)
      await db.pedido.update({
        where: { id: pedidoOriginal.id },
        data: {
          estado: "entregado",
          nota: `Entrega parcial: ${litrosEntregadosTotal}/${pedidoOriginal.litrosSolicitados} L. Resto reagendado en nuevo pedido.`,
        },
      });

      // Crear nuevo pedido para lo que falta
      const nuevoPedido = await db.pedido.create({
        data: {
          clienteId: pedidoOriginal.clienteId || null,
          clienteNombre: pedidoOriginal.clienteNombre,
          clienteDireccion: pedidoOriginal.clienteDireccion || null,
          clienteTelefono: pedidoOriginal.clienteTelefono || null,
          clienteZona: pedidoOriginal.clienteZona || null,
          clienteLat: pedidoOriginal.clienteLat || null,
          clienteLng: pedidoOriginal.clienteLng || null,
          litrosSolicitados: litrosPendientes,
          fechaSolicitada: null,
          franjaHoraria: pedidoOriginal.franjaHoraria || null,
          metodoPagoPreferido: pedidoOriginal.metodoPagoPreferido || "credito",
          indicacionesAcceso: pedidoOriginal.indicacionesAcceso || null,
          nota: `Reagendado automáticamente: faltan ${litrosPendientes} L del pedido original #${pedidoOriginal.id}.`,
          estado: "pendiente",
          asignacionTipo: pedidoOriginal.asignacionTipo || "manual",
          choferAsignadoId: pedidoOriginal.choferAsignadoId || null,
          choferId: session.userId,
          duenoId,
          pedidoRecurrenteId: pedidoOriginal.pedidoRecurrenteId || null,
        },
      });

      pedidosReagendados.push({
        cliente: pedidoOriginal.clienteNombre,
        litrosPendientes,
        litrosSolicitados: pedidoOriginal.litrosSolicitados,
        litrosEntregados: litrosEntregadosTotal,
        nuevoPedidoId: nuevoPedido.id,
        pedidoOriginalId: pedidoOriginal.id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    vuelta: actualizada,
    pedidosReagendados,
    message: pedidosReagendados.length > 0
      ? `Vuelta cerrada. Se reagendaron ${pedidosReagendados.length} pedido(s) pendiente(s).`
      : "Vuelta cerrada",
  });
}
