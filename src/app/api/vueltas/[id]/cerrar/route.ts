import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/vueltas/[id]/cerrar
//
// Cierra la vuelta.
//
// Body (opcional):
//   { reagendar?: boolean } — si es true, para cada entrega parcial (litros pendientes > 1000),
//   crea automáticamente un nuevo pedido con los litros faltantes.
//
// **IMPORTANTE**: por defecto NO se reagenda. Si el chofer/dueño quiere crear un nuevo
// pedido para los litros faltantes, debe pasar `reagendar: true` explícitamente.
// La auto-reagendación silenciosa fue removida porque creaba pedidos sin confirmación.
//
// Response:
//   {
//     ok: true,
//     vuelta: {...},
//     pedidosReagendados: [
//       { cliente: "Milko", litrosPendientes: 11000, nuevoPedidoId: "..." }
//     ],
//     entregasParciales: [
//       { cliente: "Diana Ibañez", litrosPendientes: 2000, pedidoOriginalId: "..." }
//     ]
//   }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  // Body opcional — por defecto no se reagenda
  let reagendar = false;
  try {
    const body = await req.json();
    reagendar = !!body?.reagendar;
  } catch {
    // sin body o body inválido: no reagendar
  }

  const actualizada = await db.vuelta.update({
    where: { id },
    data: { activa: false, cerradaEn: new Date() },
  });

  // === Calcular si el camión quedó vacío ===
  // El camión tiene una capacidad. Si los litros entregados en esta vuelta
  // igualan o superan la capacidad, el camión quedó vacío → el chofer no puede
  // continuar entregando (debe ir a cargar agua). En ese caso, los pedidos
  // parcialmente entregados pueden necesitar reagendación.
  // Si el camión NO quedó vacío (todavía tiene agua), el chofer puede continuar
  // con el resto de los pedidos en otra vuelta sin necesidad de reagendar.
  const vueltaConCamion = await db.vuelta.findUnique({
    where: { id },
    include: { camion: { select: { capacidad: true, nombre: true } } },
  });
  const capacidadCamion = vueltaConCamion?.camion?.capacidad ?? 0;

  // === DETECTAR ENTREGAS PARCIALES (pero NO reagendar salvo opt-in) ===
  // Buscar todos los pedidos que tengan una entrega en esta vuelta.
  // La relación es Pedido.entregaId → Entrega.id.
  const entregasDeLaVuelta = await db.entrega.findMany({
    where: { vueltaId: id },
    select: {
      id: true,
      litros: true,
      clienteId: true,
      clienteNombre: true,
    },
  });

  const totalLitrosEntregadosVuelta = entregasDeLaVuelta.reduce((s, e) => s + (e.litros || 0), 0);
  const camionVacio = capacidadCamion > 0 && totalLitrosEntregadosVuelta >= capacidadCamion * 0.95; // 95% para tolerar redondeo

  const pedidosReagendados: Array<{
    cliente: string;
    litrosPendientes: number;
    litrosSolicitados: number;
    litrosEntregados: number;
    nuevoPedidoId: string;
    pedidoOriginalId: string;
  }> = [];

  const entregasParciales: Array<{
    cliente: string;
    litrosPendientes: number;
    litrosSolicitados: number;
    litrosEntregados: number;
    pedidoOriginalId: string;
  }> = [];

  for (const entrega of entregasDeLaVuelta) {
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

    const litrosEntregadosTotal = entrega.litros;
    const litrosPendientes = pedidoOriginal.litrosSolicitados - litrosEntregadosTotal;

    // Si quedan más de 1000 L pendientes, es una entrega parcial.
    if (litrosPendientes > 1000) {
      // Si el camión NO quedó vacío, NO registrar como parcial ni sugerir reagendar.
      // El chofer todavía tiene agua para continuar en otra vuelta.
      if (!camionVacio) {
        continue;
      }

      // Registrar que fue parcial (info para que el cliente decida)
      entregasParciales.push({
        cliente: pedidoOriginal.clienteNombre,
        litrosPendientes,
        litrosSolicitados: pedidoOriginal.litrosSolicitados,
        litrosEntregados: litrosEntregadosTotal,
        pedidoOriginalId: pedidoOriginal.id,
      });

      // Marcar el pedido original como "entregado" (parcialmente) — solo si no se va a reagendar
      // (si se va a reagendar, la nota se setea en el bloque de abajo)
      if (!reagendar) {
        await db.pedido.update({
          where: { id: pedidoOriginal.id },
          data: {
            estado: "entregado",
            nota: `Entrega parcial: ${litrosEntregadosTotal}/${pedidoOriginal.litrosSolicitados} L.`,
          },
        });
      }

      // Solo crear el nuevo pedido si el cliente pidió explícitamente reagendar
      if (reagendar) {
        await db.pedido.update({
          where: { id: pedidoOriginal.id },
          data: {
            estado: "entregado",
            nota: `Entrega parcial: ${litrosEntregadosTotal}/${pedidoOriginal.litrosSolicitados} L. Resto reagendado en nuevo pedido.`,
          },
        });

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
            nota: `Reagendado: faltan ${litrosPendientes} L del pedido original #${pedidoOriginal.id}.`,
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
  }

  return NextResponse.json({
    ok: true,
    vuelta: actualizada,
    pedidosReagendados,
    entregasParciales,
    camionVacio,
    capacidadCamion,
    totalLitrosEntregadosVuelta,
    message: reagendar && pedidosReagendados.length > 0
      ? `Vuelta cerrada. Se reagendaron ${pedidosReagendados.length} pedido(s) pendiente(s).`
      : !camionVacio
        ? `Vuelta cerrada. El camión no quedó vacío (entregaste ${totalLitrosEntregadosVuelta} L de ${capacidadCamion} L de capacidad) — podés seguir en otra vuelta sin reagendar.`
        : entregasParciales.length > 0
          ? `Vuelta cerrada. El camión quedó vacío y detectamos ${entregasParciales.length} entrega(s) parcial(es). Si querés reagendar los litros faltantes, creá un pedido nuevo desde la pestaña Pedidos.`
          : "Vuelta cerrada. El camión quedó vacío.",
  });
}
