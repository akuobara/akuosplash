import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];

  // 1. Buscar entregas sin pedido vinculado que tengan clienteId
  const entregasSinPedido = await db.entrega.findMany({
    where: { clienteId: { not: null } },
    select: { id: true, clienteId: true, clienteNombre: true, fecha: true },
    orderBy: { fecha: "desc" },
    take: 50,
  });

  let vinculados = 0;
  for (const entrega of entregasSinPedido) {
    // Buscar pedido pendiente para ese cliente
    const pedidoPendiente = await db.pedido.findFirst({
      where: {
        clienteId: entrega.clienteId,
        estado: { in: ["pendiente", "programado"] },
        entregaId: null,
      },
      orderBy: { fechaSolicitada: "asc" },
    });
    if (pedidoPendiente) {
      await db.pedido.update({
        where: { id: pedidoPendiente.id },
        data: {
          estado: "entregado",
          entregaId: entrega.id,
        },
      });
      vinculados++;
      resultados.push(`Vinculado: ${entrega.clienteNombre} → entrega ${entrega.id} → pedido ${pedidoPendiente.id}`);
    }
  }

  return NextResponse.json({ ok: true, vinculados, resultados, timestamp: new Date().toISOString() });
}
