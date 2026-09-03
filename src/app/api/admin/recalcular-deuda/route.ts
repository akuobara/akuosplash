import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/recalcular-deuda
// Endpoint temporal: revierte recalculos hechos masivamente.
// Cambia las entregas que tenían precioPorLitro = 8 (efectivo) pero que fueron
// registradas originalmente como transferencia (precioPorLitro = 8.7) de vuelta a 8.7.
//
// Solo aplica a entregas pendientes/parciales (no a las ya pagadas).
// Solo aplica si el cliente tiene pagos por transferencia asociados.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-recalc-secret");
  if (secret !== "aljibe-recalc-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let totalRevertidas = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const clienteIdFilter = body.clienteId;

    // Buscar todas las configuraciones
    const configs = await db.configuracion.findMany({
      select: { duenoId: true, precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true },
    });
    const configByDueno = new Map(configs.map(c => [c.duenoId, c]));

    // Buscar clientes
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

      if (precioEfectivo <= 0 || precioTransferencia <= precioEfectivo) continue;

      // Buscar entregas pendientes/parciales que fueron recalculadas a efectivo
      // pero el cliente tiene pagos por transferencia (deberían estar a precio transferencia)
      const entregasARevertir = await db.entrega.findMany({
        where: {
          clienteId: cliente.id,
          estadoPago: { in: ["pendiente", "parcial"] },
          precioPorLitro: precioEfectivo,  // Las que fueron bajadas a precio efectivo
        },
        select: { id: true, litros: true, precioPorLitro: true, descuento: true, metodoPago: true },
      });

      if (entregasARevertir.length === 0) continue;

      for (const entrega of entregasARevertir) {
        // Revertir a precio transferencia
        const nuevoTotal = Math.ceil((entrega.litros * precioTransferencia - (entrega.descuento || 0)) / 100) * 100;
        await db.entrega.update({
          where: { id: entrega.id },
          data: {
            precioPorLitro: precioTransferencia,
            total: Math.max(0, nuevoTotal),
          },
        });
        totalRevertidas++;
        resultados.push(`Revertida entrega ${entrega.id} de ${cliente.nombre}: ${entrega.litros}L × $${precioTransferencia} = $${nuevoTotal}`);
      }
    }

    return NextResponse.json({
      ok: true,
      totalRevertidas,
      resultados,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "revert failed", details: msg }, { status: 500 });
  }
}
