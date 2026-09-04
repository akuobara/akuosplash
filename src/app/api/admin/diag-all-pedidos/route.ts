import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Buscar TODOS los pedidos de Susana García (cualquier estado)
  const pedidosSusana = await db.pedido.findMany({
    where: { clienteNombre: { contains: "Susana" } },
    select: { id: true, clienteNombre: true, estado: true, entregaId: true, litrosSolicitados: true, fechaSolicitada: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
  });

  // También buscar TODOS los pedidos creados hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const pedidosHoy = await db.pedido.findMany({
    where: { creadoEn: { gte: hoy } },
    select: { id: true, clienteNombre: true, estado: true, litrosSolicitados: true, fechaSolicitada: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
  });

  return NextResponse.json({ pedidosSusana, pedidosHoy });
}
