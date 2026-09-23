import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-recurrentes
// Lista todos los pedidos recurrentes con su estado actual:
// - fechaProximaGeneracion (cuándo debería generarse el próximo pedido)
// - activo (si está activo o pausado)
// - frecuenciaDias
// - últimos pedidos generados
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const recurrentes = await db.pedidoRecurrente.findMany({
    where: { duenoId },
    include: {
      cliente: { select: { id: true, nombre: true } },
      pedidos: {
        select: {
          id: true,
          fechaSolicitada: true,
          estado: true,
          creadoEn: true,
          clienteNombre: true,
          litrosSolicitados: true,
        },
        orderBy: { creadoEn: "desc" },
        take: 5,
      },
    },
    orderBy: { cliente: { nombre: "asc" } },
  });

  const ahora = new Date();
  
  return NextResponse.json({
    ahora: ahora.toISOString(),
    total: recurrentes.length,
    recurrentes: recurrentes.map(r => ({
      id: r.id,
      cliente: r.cliente?.nombre || "Sin cliente",
      clienteId: r.clienteId,
      activo: r.activo,
      frecuenciaDias: r.frecuenciaDias,
      fechaInicio: r.fechaInicio,
      fechaProximaGeneracion: r.fechaProximaGeneracion,
      proximaGeneracionVencida: r.fechaProximaGeneracion <= ahora,
      litrosSolicitados: r.litrosSolicitados,
      nota: r.nota,
      ultimosPedidos: r.pedidos.map(p => ({
        id: p.id,
        fechaSolicitada: p.fechaSolicitada,
        estado: p.estado,
        creadoEn: p.creadoEn,
        litros: p.litrosSolicitados,
      })),
    })),
  });
}
