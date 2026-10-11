import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { calcularProximaFechaConDiaPreferido } from "@/lib/helpers";

// GET /api/admin/diag-recurrentes
// Lista todos los pedidos recurrentes con su fechaProximaGeneracion actual,
// último pedido generado, y estado (si está vencido, futuro, etc.)
// Solo para admin/dueno autenticado.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const duenoId = session.role === "dueno" ? session.userId : session.duenoId;
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const recurrentes = await db.pedidoRecurrente.findMany({
    where: { duenoId },
    include: {
      cliente: { select: { id: true, nombre: true, direccion: true, zona: true } },
    },
    orderBy: { cliente: { nombre: "asc" } },
  });

  const ahora = new Date();
  const en7dias = new Date(ahora);
  en7dias.setDate(en7dias.getDate() + 7);

  const resultado = await Promise.all(recurrentes.map(async (rec) => {
    // Buscar el último pedido generado para este recurrente
    const ultimoPedido = await db.pedido.findFirst({
      where: { pedidoRecurrenteId: rec.id },
      orderBy: { fechaSolicitada: "desc" },
      select: { id: true, fechaSolicitada: true, estado: true, creadoEn: true },
    });

    // Contar pedidos totales generados
    const totalPedidos = await db.pedido.count({
      where: { pedidoRecurrenteId: rec.id },
    });

    const fechaProxima = rec.fechaProximaGeneracion;
    const diasHastaProxima = Math.ceil((fechaProxima.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: rec.id,
      cliente: rec.cliente.nombre,
      clienteZona: rec.cliente.zona,
      activo: rec.activo,
      frecuenciaDias: rec.frecuenciaDias,
      diaSemanaPreferido: rec.diaSemanaPreferido,
      fechaInicio: rec.fechaInicio,
      fechaProximaGeneracion: fechaProxima,
      fechaProximaGeneracionStr: fechaProxima.toISOString(),
      diasHastaProxima,
      estado: !rec.activo ? "INACTIVO"
        : diasHastaProxima < 0 ? "VENCIDO (fechaProxima en el pasado)"
        : diasHastaProxima <= 7 ? "OK (próxima en menos de 7 días)"
        : "ADELANTADO (fechaProxima está más de 7 días adelante — posible bug de doble avance)",
      ultimoPedidoGenerado: ultimoPedido
        ? {
            fechaSolicitada: ultimoPedido.fechaSolicitada,
            estado: ultimoPedido.estado,
            creadoEn: ultimoPedido.creadoEn,
          }
        : null,
      totalPedidosGenerados: totalPedidos,
    };
  }));

  return NextResponse.json({
    ahora: ahora.toISOString(),
    totalRecurrentes: recurrentes.length,
    recurrentes: resultado,
  });
}

// POST /api/admin/diag-recurrentes
// Repara todos los recurrentes "ADELANTADOS" reseteando fechaProximaGeneracion
// a la próxima fecha correcta basada en el último pedido generado.
// Body: { reparar: true } para ejecutar la reparación.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const duenoId = session.role === "dueno" ? session.userId : session.duenoId;
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  if (!body.reparar) {
    return NextResponse.json({ error: "Falta { reparar: true } en el body" }, { status: 400 });
  }

  const recurrentes = await db.pedidoRecurrente.findMany({
    where: { duenoId, activo: true },
    include: { cliente: { select: { nombre: true } } },
  });

  const ahora = new Date();
  const reparados: { id: string; cliente: string; anterior: string; nueva: string; accion: string }[] = [];

  for (const rec of recurrentes) {
    const fechaProximaActual = rec.fechaProximaGeneracion;
    const diasHastaProxima = Math.ceil((fechaProximaActual.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    // Si la fechaProxima está más de 7 días adelante, reparar
    if (diasHastaProxima > 7) {
      // Buscar el último pedido generado para este recurrente
      const ultimoPedido = await db.pedido.findFirst({
        where: { pedidoRecurrenteId: rec.id },
        orderBy: { fechaSolicitada: "desc" },
        select: { fechaSolicitada: true },
      });

      let nuevaFecha: Date;
      if (ultimoPedido && ultimoPedido.fechaSolicitada) {
        // Calcular próxima fecha desde el último pedido
        nuevaFecha = calcularProximaFechaConDiaPreferido(
          ultimoPedido.fechaSolicitada,
          rec.frecuenciaDias,
          rec.diaSemanaPreferido
        );
      } else {
        // No hay pedidos previos — usar fechaInicio
        nuevaFecha = calcularProximaFechaConDiaPreferido(
          rec.fechaInicio,
          rec.frecuenciaDias,
          rec.diaSemanaPreferido
        );
      }

      // Si la nueva fecha ya pasó, avanzar hasta que sea futura o de hoy
      while (nuevaFecha < ahora) {
        nuevaFecha = calcularProximaFechaConDiaPreferido(
          nuevaFecha,
          rec.frecuenciaDias,
          rec.diaSemanaPreferido
        );
      }

      await db.pedidoRecurrente.update({
        where: { id: rec.id },
        data: { fechaProximaGeneracion: nuevaFecha },
      });

      reparados.push({
        id: rec.id,
        cliente: rec.cliente.nombre,
        anterior: fechaProximaActual.toISOString(),
        nueva: nuevaFecha.toISOString(),
        accion: "fechaProximaGeneracion reseteada",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalRevisados: recurrentes.length,
    totalReparados: reparados.length,
    reparados,
  });
}
