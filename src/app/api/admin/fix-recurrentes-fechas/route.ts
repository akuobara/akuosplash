import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/fix-recurrentes-fechas
// Recalcula fechaProximaGeneracion para todos los recurrentes basándose en
// la fecha de la última entrega al cliente + frecuenciaDias.
// Esto arregla el bug donde las fechas se desfasaban.
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const recurrentes = await db.pedidoRecurrente.findMany({
    where: { duenoId, activo: true },
    include: { cliente: { select: { id: true, nombre: true } } },
  });

  const arreglados: any[] = [];
  const sinCambios: any[] = [];

  for (const rec of recurrentes) {
    // Buscar la última entrega al cliente
    const ultimaEntrega = await db.entrega.findFirst({
      where: { clienteId: rec.clienteId, duenoId },
      select: { fecha: true, clienteNombre: true },
      orderBy: { fecha: "desc" },
    });

    if (!ultimaEntrega) {
      // Si no hay entregas, dejar la fechaProximaGeneracion como está
      sinCambios.push({
        cliente: rec.cliente?.nombre,
        frecuenciaDias: rec.frecuenciaDias,
        fechaProximaGeneracion: rec.fechaProximaGeneracion,
        razon: "Sin entregas previas",
      });
      continue;
    }

    // Calcular la fecha correcta: última entrega + frecuenciaDias
    const fechaCorrecta = new Date(ultimaEntrega.fecha);
    fechaCorrecta.setDate(fechaCorrecta.getDate() + rec.frecuenciaDias);
    // Ajustar a medianoche UTC
    fechaCorrecta.setHours(0, 0, 0, 0);

    const fechaActual = rec.fechaProximaGeneracion;
    const diferenciaDias = Math.round((fechaCorrecta.getTime() - fechaActual.getTime()) / (1000 * 60 * 60 * 24));

    if (Math.abs(diferenciaDias) > 0) {
      // Actualizar la fecha
      await db.pedidoRecurrente.update({
        where: { id: rec.id },
        data: { fechaProximaGeneracion: fechaCorrecta },
      });

      arreglados.push({
        recurrenteId: rec.id,
        cliente: rec.cliente?.nombre,
        frecuenciaDias: rec.frecuenciaDias,
        ultimaEntrega: ultimaEntrega.fecha,
        fechaAnterior: fechaActual,
        fechaNueva: fechaCorrecta,
        diferenciaDias,
      });
    } else {
      sinCambios.push({
        cliente: rec.cliente?.nombre,
        frecuenciaDias: rec.frecuenciaDias,
        fechaProximaGeneracion: fechaActual,
        razon: "Ya correcta",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    totalRecurrentes: recurrentes.length,
    arreglados: arreglados.length,
    sinCambios: sinCambios.length,
    detalleArreglados: arreglados,
    detalleSinCambios: sinCambios,
    message: `Se corrigieron ${arreglados.length} recurrente(s). ${sinCambios.length} ya estaban correctos.`,
  });
}
