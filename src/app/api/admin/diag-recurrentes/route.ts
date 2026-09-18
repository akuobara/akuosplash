import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const recurrentes = await db.pedidoRecurrente.findMany({
    where: { activo: true },
    select: {
      id: true,
      clienteId: true,
      cliente: { select: { nombre: true } },
      litrosSolicitados: true,
      frecuenciaDias: true,
      fechaInicio: true,
      fechaProximaGeneracion: true,
    },
    orderBy: { fechaProximaGeneracion: "asc" },
  });

  // También ver todos los pedidos pendientes/programados con sus fechas
  const pedidos = await db.pedido.findMany({
    where: { estado: { in: ["pendiente", "programado"] } },
    select: {
      id: true,
      clienteNombre: true,
      litrosSolicitados: true,
      fechaSolicitada: true,
      creadoEn: true,
      estado: true,
      pedidoRecurrenteId: true,
    },
    orderBy: { fechaSolicitada: "asc" },
  });

  return NextResponse.json({ recurrentes, pedidos });
}
