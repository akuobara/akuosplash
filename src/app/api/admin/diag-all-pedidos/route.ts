import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];

  // Buscar el pedido de Susana García marcado como entregado hoy
  const pedido = await db.pedido.findFirst({
    where: {
      clienteNombre: { contains: "Susana" },
      estado: "entregado",
    },
    select: { id: true, clienteNombre: true, entregaId: true, litrosSolicitados: true, fechaSolicitada: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
  });

  if (pedido) {
    // Restaurar a pendiente y desvincular la entrega
    await db.pedido.update({
      where: { id: pedido.id },
      data: {
        estado: "pendiente",
        entregaId: null,
      },
    });
    resultados.push(`Revertido: ${pedido.clienteNombre} → estado=pendiente, entregaId=null (era entregado con entregaId=${pedido.entregaId})`);
  } else {
    resultados.push("No se encontró pedido de Susana García entregado");
  }

  return NextResponse.json({ ok: true, resultados, timestamp: new Date().toISOString() });
}
