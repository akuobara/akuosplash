import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/cleanup-duplicadas
// Encuentra y elimina entregas duplicadas (mismo cliente+vuelta+litros+total en <30s).
// Endpoint temporal - borrar después de usar.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cleanup-secret");
  if (secret !== "aljibe-cleanup-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let duplicadasBorradas = 0;

  // Buscar todas las entregas ordenadas por fecha, chofer, vuelta
  const entregas = await db.entrega.findMany({
    orderBy: [{ choferId: "asc" }, { vueltaId: "asc" }, { fecha: "asc" }],
    select: {
      id: true, clienteId: true, clienteNombre: true, litros: true, total: true,
      fecha: true, vueltaId: true, choferId: true, metodoPago: true, estadoPago: true,
    },
  });

  // Agrupar y detectar duplicadas (misma chofer+vuelta+cliente+litros+total dentro de 30s)
  for (let i = 1; i < entregas.length; i++) {
    const prev = entregas[i - 1];
    const curr = entregas[i];

    if (!curr.vueltaId || !prev.vueltaId) continue;
    if (curr.vueltaId !== prev.vueltaId) continue;
    if (curr.choferId !== prev.choferId) continue;
    if (curr.clienteId !== prev.clienteId) continue;
    if (curr.litros !== prev.litros) continue;
    if (curr.total !== prev.total) continue;

    // Dentro de 30 segundos?
    const diffMs = Math.abs(curr.fecha.getTime() - prev.fecha.getTime());
    if (diffMs > 30 * 1000) continue;

    // Duplicada encontrada - borrar la más nueva (curr)
    const detalles = `cliente='${curr.clienteNombre}', ${curr.litros}L, $${curr.total}, vuelta=${curr.vueltaId}, fecha=${curr.fecha.toISOString()}`;

    // Verificar que no tenga un pago asociado (no queremos borrar entregas con pagos)
    const pagosAsociados = await db.pago.count({ where: { entregaId: curr.id } });
    if (pagosAsociados > 0) {
      resultados.push(`SKIP ${curr.id} (${detalles}) - tiene ${pagosAsociados} pago(s) asociado(s)`);
      continue;
    }

    // Verificar si la entrega está vinculada a un pedido
    const pedidoVinculado = await db.pedido.findFirst({ where: { entregaId: curr.id } });
    if (pedidoVinculado) {
      // Desvincular el pedido (revertir estado a pendiente)
      await db.pedido.update({
        where: { id: pedidoVinculado.id },
        data: { estado: "pendiente", entregaId: null, vueltaId: null },
      });
      resultados.push(`Pedido ${pedidoVinculado.id} desvinculado de entrega ${curr.id}`);
    }

    await db.entrega.delete({ where: { id: curr.id } });
    duplicadasBorradas++;
    resultados.push(`DELETED ${curr.id} (${detalles})`);
  }

  return NextResponse.json({
    ok: true,
    duplicadasBorradas,
    detalles: resultados,
    timestamp: new Date().toISOString(),
  });
}
