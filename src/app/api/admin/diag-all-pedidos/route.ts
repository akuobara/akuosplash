import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await db.pedido.findMany({
    where: { estado: { in: ["pendiente", "programado"] } },
    select: { id: true, clienteNombre: true, estado: true, entregaId: true, litrosSolicitados: true, fechaSolicitada: true, creadoEn: true, pedidoRecurrenteId: true },
    orderBy: { fechaSolicitada: "asc" },
  });

  return NextResponse.json({ total: pedidos.length, pedidos });
}
