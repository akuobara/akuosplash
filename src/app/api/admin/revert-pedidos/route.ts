import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revert-secret");
  if (secret !== "aljibe-revert-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let revertidos = 0;

  // Buscar pedidos marcados como "entregado" SIN entregaId
  // (los que mi script marcó incorrectamente sin vincular)
  const pedidosMalMarcados = await db.pedido.findMany({
    where: {
      estado: "entregado",
      entregaId: null,
    },
    select: { id: true, clienteNombre: true, fechaSolicitada: true, litrosSolicitados: true, creadoEn: true },
    orderBy: { creadoEn: "desc" },
  });

  for (const p of pedidosMalMarcados) {
    // Restaurar estado: si la fecha es futura → "programado", si es hoy/pasada → "pendiente"
    const fecha = p.fechaSolicitada ? new Date(p.fechaSolicitada) : null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const estadoOriginal = (fecha && fecha > hoy) ? "programado" : "pendiente";

    await db.pedido.update({
      where: { id: p.id },
      data: { estado: estadoOriginal },
    });
    revertidos++;
    resultados.push(`Revertido: ${p.clienteNombre} | ${p.litrosSolicitados}L | fecha=${p.fechaSolicitada?.toISOString().slice(0,10) || 'sin fecha'} | estado→${estadoOriginal}`);
  }

  return NextResponse.json({ ok: true, revertidos, resultados, timestamp: new Date().toISOString() });
}
