import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let vinculados = 0;

  // Buscar pedidos pendientes/programados sin entrega
  const pedidosPendientes = await db.pedido.findMany({
    where: {
      estado: { in: ["pendiente", "programado"] },
      entregaId: null,
      clienteId: { not: null },
    },
    select: { id: true, clienteId: true, clienteNombre: true, fechaSolicitada: true, litrosSolicitados: true },
    orderBy: { fechaSolicitada: "asc" },
  });

  for (const pedido of pedidosPendientes) {
    // Buscar la entrega más reciente de ese cliente que no tenga ya un pedido vinculado
    const entrega = await db.entrega.findFirst({
      where: { clienteId: pedido.clienteId },
      orderBy: { fecha: "desc" },
      select: { id: true, fecha: true, litros: true },
    });
    if (!entrega) {
      resultados.push(`SKIP ${pedido.clienteNombre}: no hay entregas`);
      continue;
    }

    // Verificar que esa entrega no esté ya vinculada a otro pedido
    const yaVinculada = await db.pedido.findFirst({
      where: { entregaId: entrega.id },
      select: { id: true },
    });
    if (yaVinculada) {
      // Marcar el pedido como entregado SIN vincular a la entrega (porque ya está vinculada)
      await db.pedido.update({
        where: { id: pedido.id },
        data: { estado: "entregado" },
      });
      resultados.push(`Marcado entregado (sin vincular): ${pedido.clienteNombre} - entrega ${entrega.id} ya vinculada a otro pedido`);
      vinculados++;
      continue;
    }

    // Vincular
    try {
      await db.pedido.update({
        where: { id: pedido.id },
        data: { estado: "entregado", entregaId: entrega.id },
      });
      resultados.push(`Vinculado: ${pedido.clienteNombre} → entrega ${entrega.id} (${entrega.litros}L ${entrega.fecha.toISOString().slice(0,10)})`);
      vinculados++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      resultados.push(`ERROR ${pedido.clienteNombre}: ${msg}`);
    }
  }

  return NextResponse.json({ ok: true, vinculados, resultados, timestamp: new Date().toISOString() });
}
