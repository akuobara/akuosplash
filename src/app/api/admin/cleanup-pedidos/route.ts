import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/cleanup-pedidos
// Endpoint temporal para limpiar pedidos inconsistentes.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cleanup-secret");
  if (secret !== "aljibe-cleanup-pedidos-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let borrados = 0;
  let marcadosEntregado = 0;

  try {
    // 1. Buscar grupos de pedidos duplicados (mismo cliente + litros + fecha)
    const pedidos = await db.pedido.findMany({
      orderBy: [{ creadoEn: "asc" }],
      select: {
        id: true, clienteNombre: true, clienteId: true, litrosSolicitados: true,
        fechaSolicitada: true, creadoEn: true, estado: true,
        pedidoRecurrenteId: true, entregaId: true,
      },
    });

    const grupos: Record<string, typeof pedidos> = {};
    for (const p of pedidos) {
      const key = `${p.clienteId || p.clienteNombre}|${p.litrosSolicitados}|${p.fechaSolicitada?.toISOString() || "sinfecha"}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(p);
    }

    // 2. Para cada grupo duplicado, conservar el mejor y borrar el resto
    for (const [key, groupPedidos] of Object.entries(grupos)) {
      if (groupPedidos.length <= 1) continue;

      const conEntrega = groupPedidos.find(p => p.entregaId);
      const aConservar = conEntrega || groupPedidos[groupPedidos.length - 1];
      const aBorrar = groupPedidos.filter(p => p.id !== aConservar.id);

      for (const p of aBorrar) {
        if (p.entregaId && !aConservar.entregaId && aConservar.estado !== "entregado") {
          await db.pedido.update({
            where: { id: aConservar.id },
            data: { estado: "entregado", entregaId: p.entregaId },
          });
          resultados.push(`Movida entrega ${p.entregaId} de pedido ${p.id} al conservado ${aConservar.id} (${p.clienteNombre})`);
        }
        await db.pedido.delete({ where: { id: p.id } });
        borrados++;
        resultados.push(`DELETED pedido duplicado ${p.id} (${p.clienteNombre}, ${p.litrosSolicitados}L, fecha=${p.fechaSolicitada})`);
      }
    }

    // 3. Vincular entregas a pedidos pendientes huérfanos
    const pendientesSinEntrega = await db.pedido.findMany({
      where: { estado: "pendiente", entregaId: null, clienteId: { not: null } },
      select: { id: true, clienteId: true, clienteNombre: true, litrosSolicitados: true, fechaSolicitada: true },
    });

    for (const pedido of pendientesSinEntrega) {
      const hace3dias = new Date();
      hace3dias.setDate(hace3dias.getDate() - 3);

      const entregasCandidatas = await db.entrega.findMany({
        where: { clienteId: pedido.clienteId, fecha: { gte: hace3dias } },
        orderBy: { fecha: "desc" },
        select: { id: true, litros: true, total: true, fecha: true },
      });

      if (entregasCandidatas.length === 0) continue;

      // Estrategia:
      // 1. Si el pedido tiene litros>0, buscar entrega que coincida (tolerancia 50L)
      // 2. Si el pedido tiene litros=0, tomar la entrega más reciente (últimos 3 días)
      //    siempre que sea posterior a la fecha del pedido (o sin fecha)
      let match: typeof entregasCandidatas[0] | undefined;
      if (pedido.litrosSolicitados > 0) {
        match = entregasCandidatas.find(e =>
          Math.abs(e.litros - pedido.litrosSolicitados) < 50
        );
      } else {
        // Pedido sin litros especificados: tomar la más reciente
        // Si el pedido tiene fecha, la entrega debe ser posterior
        if (pedido.fechaSolicitada) {
          match = entregasCandidatas.find(e => e.fecha > pedido.fechaSolicitada!);
        } else {
          match = entregasCandidatas[0]; // más reciente
        }
      }

      if (match) {
        await db.pedido.update({
          where: { id: pedido.id },
          data: { estado: "entregado", entregaId: match.id },
        });
        marcadosEntregado++;
        resultados.push(`Vinculado pedido ${pedido.id} (${pedido.clienteNombre}) a entrega ${match.id} (${match.litros}L, ${match.fecha})`);
      }
    }

    return NextResponse.json({
      ok: true,
      borrados,
      marcadosEntregado,
      resultados,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "cleanup failed", details: msg }, { status: 500 });
  }
}
