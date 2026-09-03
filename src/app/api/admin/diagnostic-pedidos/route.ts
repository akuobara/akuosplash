import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/diagnostic-pedidos
// Endpoint temporal para diagnosticar pedidos duplicados / inconsistentes.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // 1. Todos los pedidos con sus relaciones
    const pedidos = await db.pedido.findMany({
      orderBy: [{ creadoEn: "asc" }],
      select: {
        id: true,
        clienteNombre: true,
        clienteId: true,
        litrosSolicitados: true,
        fechaSolicitada: true,
        creadoEn: true,
        estado: true,
        pedidoRecurrenteId: true,
        entregaId: true,
        entrega: { select: { id: true, litros: true, total: true, fecha: true } },
      },
    });

    // 2. Detectar duplicados (mismo cliente + litros + fecha próxima)
    const gruposDuplicados: Record<string, typeof pedidos> = {};
    for (const p of pedidos) {
      const key = `${p.clienteId || p.clienteNombre}|${p.litrosSolicitados}|${p.fechaSolicitada?.toISOString() || "sinfecha"}`;
      if (!gruposDuplicados[key]) gruposDuplicados[key] = [];
      gruposDuplicados[key].push(p);
    }

    const duplicados = Object.entries(gruposDuplicados)
      .filter(([, arr]) => arr.length > 1)
      .map(([key, arr]) => ({ key, count: arr.length, pedidos: arr }));

    // 3. Pedidos marcados como pendientes pero con entrega asociada
    const pendientesConEntrega = pedidos.filter(p => p.estado === "pendiente" && p.entregaId);

    // 4. Pedidos recurrentes y su fechaProximaGeneracion
    const recurrentes = await db.pedidoRecurrente.findMany({
      where: { activo: true },
      select: {
        id: true,
        clienteId: true,
        cliente: { select: { nombre: true } },
        litrosSolicitados: true,
        frecuenciaDias: true,
        fechaProximaGeneracion: true,
      },
    });

    // 5. Entregas recientes (últimos 3 días) para diagnóstico
    const hace3dias = new Date();
    hace3dias.setDate(hace3dias.getDate() - 3);
    const entregasRecientes = await db.entrega.findMany({
      where: { fecha: { gte: hace3dias } },
      orderBy: { fecha: "desc" },
      select: {
        id: true, clienteNombre: true, clienteId: true, litros: true,
        total: true, fecha: true, estadoPago: true,
      },
    });

    return NextResponse.json({
      totalPedidos: pedidos.length,
      pedidos: pedidos.map(p => ({
        id: p.id,
        cliente: p.clienteNombre,
        clienteId: p.clienteId,
        litros: p.litrosSolicitados,
        fechaSolicitada: p.fechaSolicitada,
        creadoEn: p.creadoEn,
        estado: p.estado,
        recurrenteId: p.pedidoRecurrenteId,
        entregaId: p.entregaId,
        tieneEntrega: !!p.entrega,
        entrega: p.entrega ? { litros: p.entrega.litros, total: p.entrega.total, fecha: p.entrega.fecha } : null,
      })),
      duplicados,
      pendientesConEntrega: pendientesConEntrega.map(p => ({
        id: p.id,
        cliente: p.clienteNombre,
        estado: p.estado,
        entregaId: p.entregaId,
        entregaLitros: p.entrega?.litros,
        entregaFecha: p.entrega?.fecha,
      })),
      recurrentes: recurrentes.map(r => ({
        id: r.id,
        clienteId: r.clienteId,
        clienteNombre: r.cliente?.nombre,
        litrosSolicitados: r.litrosSolicitados,
        frecuenciaDias: r.frecuenciaDias,
        fechaProximaGeneracion: r.fechaProximaGeneracion,
      })),
      entregasRecientes: entregasRecientes.map(e => ({
        id: e.id,
        clienteNombre: e.clienteNombre,
        clienteId: e.clienteId,
        litros: e.litros,
        total: e.total,
        fecha: e.fecha,
        estadoPago: e.estadoPago,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "diagnostic failed", details: msg }, { status: 500 });
  }
}

