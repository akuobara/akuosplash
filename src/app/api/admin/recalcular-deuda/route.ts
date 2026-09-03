import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/recalcular-deuda
// Endpoint temporal: para cada cliente con entregas pendientes/parciales cuyo
// precioPorLitro > precioEfectivo (del cliente o global), recalcular esas entregas
// al precio efectivo. Esto aplica el fix retroactivamente a clientes como Almácigos.
//
// Body opcional: { clienteId: "..." } para limitar a un cliente específico.
// Si no se pasa clienteId, se aplica a todos los clientes.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-recalc-secret");
  if (secret !== "aljibe-recalc-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let totalRecalculadas = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const clienteIdFilter = body.clienteId;

    // Buscar todas las configuraciones (una por dueño)
    const configs = await db.configuracion.findMany({
      select: { duenoId: true, precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true },
    });
    const configByDueno = new Map(configs.map(c => [c.duenoId, c]));

    // Buscar clientes (con filtro opcional)
    const clientesWhere: Record<string, unknown> = {};
    if (clienteIdFilter) clientesWhere.id = clienteIdFilter;
    const clientes = await db.cliente.findMany({
      where: clientesWhere,
      select: {
        id: true, nombre: true, duenoId: true,
        precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true,
      },
    });

    for (const cliente of clientes) {
      const config = configByDueno.get(cliente.duenoId);
      const precioEfectivo = cliente.precioEfectivoPorLitro || config?.precioEfectivoPorLitro || 0;
      const precioTransferencia = cliente.precioTransferenciaPorLitro || config?.precioTransferenciaPorLitro || 0;

      if (precioEfectivo <= 0) continue;
      if (precioTransferencia <= precioEfectivo) continue;

      // Buscar entregas pendientes/parciales con precioPorLitro > precioEfectivo
      const entregasImpagas = await db.entrega.findMany({
        where: {
          clienteId: cliente.id,
          estadoPago: { in: ["pendiente", "parcial"] },
          precioPorLitro: { gt: precioEfectivo },
        },
        select: { id: true, litros: true, precioPorLitro: true, descuento: true },
      });

      if (entregasImpagas.length === 0) continue;

      for (const entrega of entregasImpagas) {
        const nuevoTotal = Math.ceil((entrega.litros * precioEfectivo - (entrega.descuento || 0)) / 100) * 100;
        await db.entrega.update({
          where: { id: entrega.id },
          data: {
            precioPorLitro: precioEfectivo,
            total: Math.max(0, nuevoTotal),
          },
        });
        totalRecalculadas++;
        resultados.push(`Recalculada entrega ${entrega.id} de ${cliente.nombre}: ${entrega.litros}L × $${precioEfectivo} = $${nuevoTotal}`);
      }
    }

    return NextResponse.json({
      ok: true,
      totalRecalculadas,
      resultados,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "recalc failed", details: msg }, { status: 500 });
  }
}
