import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await db.pedido.findMany({
    where: { clienteNombre: { contains: "Flor" } },
    select: {
      id: true,
      clienteNombre: true,
      clienteId: true,
      estado: true,
      litrosSolicitados: true,
      fechaSolicitada: true,
      creadoEn: true,
      choferId: true,
      pedidoRecurrenteId: true,
      entregaId: true,
    },
    orderBy: { creadoEn: "desc" },
  });

  // Buscar el chofer que lo creó
  const choferIds = [...new Set(pedidos.map(p => p.choferId).filter(Boolean))];
  const choferes = await db.usuario.findMany({
    where: { id: { in: choferIds } },
    select: { id: true, nombre: true, email: true, role: true },
  });

  return NextResponse.json({ pedidos, choferes });
}
