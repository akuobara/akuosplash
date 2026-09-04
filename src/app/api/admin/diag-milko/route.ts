import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Buscar pedidos de Milko
  const pedidos = await db.pedido.findMany({
    where: { clienteNombre: { contains: "Milko" } },
    select: { id: true, clienteNombre: true, estado: true, entregaId: true, litrosSolicitados: true, fechaSolicitada: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
  });

  // Buscar entregas de Milko recientes
  const entregas = await db.entrega.findMany({
    where: { clienteNombre: { contains: "Milko" } },
    select: { id: true, clienteNombre: true, litros: true, total: true, fecha: true, estadoPago: true },
    orderBy: { fecha: "desc" },
    take: 5,
  });

  return NextResponse.json({ pedidos, entregas });
}
