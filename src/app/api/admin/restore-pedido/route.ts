import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/admin/restore-pedido
// Restaura un pedido cancelado por error (lo vuelve a poner en pendiente/programado).
// Body: { pedidoId?: string, clienteNombre?: string, fechaSolicitada?: string }
//   - Si se pasa pedidoId: restaura ESE pedido específico
//   - Si se pasa clienteNombre + fechaSolicitada: busca y restaura el pedido cancelado
//     de ese cliente para esa fecha
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { pedidoId, clienteNombre, fechaSolicitada } = body;

  if (!pedidoId && !clienteNombre) {
    return NextResponse.json({ error: "Se requiere pedidoId o clienteNombre" }, { status: 400 });
  }

  // Si se pasa pedidoId, restaurar ese
  if (pedidoId) {
    const pedido = await db.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido || pedido.duenoId !== duenoId) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.estado !== "cancelado") {
      return NextResponse.json({ error: `El pedido no está cancelado (estado: ${pedido.estado})` }, { status: 400 });
    }
    // Restaurar: si tenía fechaSolicitada en el futuro, poner "programado"; si no, "pendiente"
    const estadoRestaurado = pedido.fechaSolicitada && new Date(pedido.fechaSolicitada) > new Date() ? "programado" : "pendiente";
    const actualizado = await db.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: estadoRestaurado,
        nota: pedido.nota ? `${pedido.nota} — Restaurado el ${new Date().toLocaleString("es-CL")}` : `Restaurado el ${new Date().toLocaleString("es-CL")}`,
      },
    });
    return NextResponse.json({
      ok: true,
      message: `Pedido restaurado a estado "${estadoRestaurado}"`,
      pedido: { id: actualizado.id, clienteNombre: actualizado.clienteNombre, fechaSolicitada: actualizado.fechaSolicitada, estado: actualizado.estado },
    });
  }

  // Búsqueda por clienteNombre + fechaSolicitada
  // Buscar pedidos cancelados que coincidan
  const inicioHoy = new Date(); inicioHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(); finHoy.setHours(23, 59, 59, 999);

  let fechaInicio: Date, fechaFin: Date;
  if (fechaSolicitada) {
    fechaInicio = new Date(fechaSolicitada); fechaInicio.setHours(0, 0, 0, 0);
    fechaFin = new Date(fechaSolicitada); fechaFin.setHours(23, 59, 59, 999);
  } else {
    // Sin fecha → buscar en hoy (lo más probable según el bug)
    fechaInicio = inicioHoy;
    fechaFin = finHoy;
  }

  const candidatos = await db.pedido.findMany({
    where: {
      duenoId,
      estado: "cancelado",
      clienteNombre: { contains: clienteNombre },
      OR: [
        { fechaSolicitada: { gte: fechaInicio, lte: fechaFin } },
        // Si no tiene fechaSolicitada, mirar creadoEn (cuándo se canceló/generó)
        { fechaSolicitada: null, creadoEn: { gte: fechaInicio, lte: fechaFin } },
      ],
    },
    orderBy: { creadoEn: "desc" },
    take: 10,
    select: { id: true, clienteNombre: true, fechaSolicitada: true, creadoEn: true, nota: true, estado: true },
  });

  if (candidatos.length === 0) {
    // Buscar más amplio: cualquier cancelado en los últimos 3 días con ese cliente
    const hace3dias = new Date(); hace3dias.setDate(hace3dias.getDate() - 3); hace3dias.setHours(0, 0, 0, 0);
    const candidatosAmp = await db.pedido.findMany({
      where: {
        duenoId,
        estado: "cancelado",
        clienteNombre: { contains: clienteNombre },
        creadoEn: { gte: hace3dias },
      },
      orderBy: { creadoEn: "desc" },
      take: 20,
      select: { id: true, clienteNombre: true, fechaSolicitada: true, creadoEn: true, nota: true, estado: true },
    });
    if (candidatosAmp.length === 0) {
      return NextResponse.json({
        error: `No se encontraron pedidos cancelados para "${clienteNombre}" en las últimas 72 horas`,
      }, { status: 404 });
    }
    return NextResponse.json({
      ok: false,
      candidatos: candidatosAmp.map(p => ({
        id: p.id,
        cliente: p.clienteNombre,
        fechaSolicitada: p.fechaSolicitada,
        canceladoEn: p.creadoEn,
        nota: p.nota,
      })),
      message: "Se encontraron pedidos cancelados. Llamá de nuevo con pedidoId para restaurar uno.",
    });
  }

  // Restaurar el más reciente
  const aRestaurar = candidatos[0];
  const estadoRestaurado = aRestaurar.fechaSolicitada && new Date(aRestaurar.fechaSolicitada) > new Date() ? "programado" : "pendiente";
  const actualizado = await db.pedido.update({
    where: { id: aRestaurar.id },
    data: {
      estado: estadoRestaurado,
      nota: aRestaurar.nota ? `${aRestaurar.nota} — Restaurado el ${new Date().toLocaleString("es-CL")}` : `Restaurado el ${new Date().toLocaleString("es-CL")}`,
    },
  });
  return NextResponse.json({
    ok: true,
    message: `Pedido de ${actualizado.clienteNombre} restaurado a estado "${estadoRestaurado}"`,
    pedido: {
      id: actualizado.id,
      cliente: actualizado.clienteNombre,
      fechaSolicitada: actualizado.fechaSolicitada,
      estado: actualizado.estado,
    },
    otrosCandidatos: candidatos.slice(1).map(p => ({ id: p.id, cliente: p.clienteNombre, fecha: p.fechaSolicitada })),
  });
}

// GET — lista los pedidos cancelados recientes para inspección
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const clienteBuscar = url.searchParams.get("cliente") || "";
  const hace72h = new Date(); hace72h.setDate(hace72h.getDate() - 3); hace72h.setHours(0, 0, 0, 0);

  const pedidos = await db.pedido.findMany({
    where: {
      duenoId,
      estado: "cancelado",
      creadoEn: { gte: hace72h },
      ...(clienteBuscar ? { clienteNombre: { contains: clienteBuscar } } : {}),
    },
    orderBy: { creadoEn: "desc" },
    take: 30,
    select: {
      id: true, clienteNombre: true, fechaSolicitada: true, creadoEn: true,
      nota: true, estado: true, litrosSolicitados: true,
      pedidoRecurrenteId: true,
    },
  });

  return NextResponse.json({
    canceladosRecientes: pedidos.map(p => ({
      id: p.id,
      cliente: p.clienteNombre,
      litros: p.litrosSolicitados,
      fechaSolicitada: p.fechaSolicitada,
      creadoEn: p.creadoEn,
      nota: p.nota,
      recurrenteId: p.pedidoRecurrenteId,
    })),
  });
}
