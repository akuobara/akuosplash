import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cleanup-secret");
  if (secret !== "aljibe-cleanup-pedidos-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let borrados = 0;

  // Buscar todos los pedidos pendientes/programados agrupados por cliente+litros+fecha
  const pedidos = await db.pedido.findMany({
    where: { estado: { in: ["pendiente", "programado"] } },
    orderBy: [{ creadoEn: "asc" }],
    select: { id: true, clienteId: true, clienteNombre: true, litrosSolicitados: true, fechaSolicitada: true, creadoEn: true, pedidoRecurrenteId: true },
  });

  const grupos: Record<string, typeof pedidos> = {};
  for (const p of pedidos) {
    const key = `${p.clienteId || p.clienteNombre}|${p.litrosSolicitados}|${p.fechaSolicitada?.toISOString() || ""}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(p);
  }

  for (const [key, group] of Object.entries(grupos)) {
    if (group.length <= 1) continue;
    // Conservar el primero, borrar el resto
    const aConservar = group[0];
    const aBorrar = group.slice(1);
    for (const p of aBorrar) {
      await db.pedido.delete({ where: { id: p.id } });
      borrados++;
      resultados.push(`DELETED ${p.id} (${p.clienteNombre}, ${p.litrosSolicitados}L, ${p.fechaSolicitada})`);
    }
  }

  return NextResponse.json({ ok: true, borrados, resultados, timestamp: new Date().toISOString() });
}
