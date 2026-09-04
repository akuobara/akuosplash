import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await db.pedido.findMany({
    where: { estado: { in: ["pendiente", "programado"] } },
    select: {
      id: true, clienteNombre: true, clienteId: true,
      litrosSolicitados: true, fechaSolicitada: true, estado: true,
    },
    orderBy: { fechaSolicitada: "asc" },
  });

  const hoy = new Date();
  const hoyStr = hoy.toLocaleDateString("en-CA");

  return NextResponse.json({
    hoyStr,
    pedidos: pedidos.map(p => ({
      ...p,
      fechaStr: p.fechaSolicitada ? p.fechaSolicitada.split("T")[0] : null,
      paraHoy: !p.fechaSolicitada ? true : (p.fechaSolicitada.split("T")[0] <= hoyStr),
    })),
    total: pedidos.length,
    paraHoy: pedidos.filter(p => !p.fechaSolicitada ? true : (p.fechaSolicitada.split("T")[0] <= hoyStr)).length,
  });
}
