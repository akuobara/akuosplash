import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/recalcular-deuda
// Endpoint temporal: corrige entregas con precioPorLitro=0 pero total>0.
// Esto pasa cuando una entrega se registró como "Sin pago" pero el total se calculó
// correctamente con el precio transferencia. Al pagar con "precio efectivo", el backend
// no encontraba estas entregas porque buscaba por precioPorLitro=transferencia, no =0.
//
// Estrategia: para cada entrega pendiente/parcial con precioPorLitro=0 Y total>0:
// 1. Calcular cuál fue el precio original (total / litros)
// 2. Si el pago reciente fue "precio efectivo", recalcular al precio efectivo
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-recalc-secret");
  if (secret !== "aljibe-recalc-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];
  let totalCorregidas = 0;

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

      if (precioEfectivo <= 0) continue;

      // Buscar entregas pendientes/parciales con precioPorLitro=0 Y total>0
      // Estas son entregas que se registraron como "Sin pago" pero tienen un total calculado
      const entregasRaras = await db.entrega.findMany({
        where: {
          clienteId: cliente.id,
          estadoPago: { in: ["pendiente", "parcial"] },
          precioPorLitro: 0,
          total: { gt: 0 },
        },
        select: { id: true, litros: true, precioPorLitro: true, total: true, descuento: true, metodoPago: true },
      });

      for (const entrega of entregasRaras) {
        if (entrega.litros <= 0) continue;

        // Detectar el precio original: si total/litros ≈ precioEfectivo → era efectivo
        // Si total/litros ≈ precioTransferencia → era transferencia
        const precioCalculado = (entrega.total + (entrega.descuento || 0)) / entrega.litros;
        const eraTransferencia = Math.abs(precioCalculado - precioTransferencia) < 0.5;
        const eraEfectivo = Math.abs(precioCalculado - precioEfectivo) < 0.5;

        let nuevoPrecio: number;
        let nuevoTotal: number;

        if (eraTransferencia) {
          // Era transferencia, recalcular a efectivo (porque el usuario pago con "precio efectivo")
          nuevoPrecio = precioEfectivo;
          nuevoTotal = Math.ceil((entrega.litros * precioEfectivo - (entrega.descuento || 0)) / 100) * 100;
          nuevoTotal = Math.max(0, nuevoTotal);
        } else if (eraEfectivo) {
          // Ya estaba al precio efectivo, solo fix el precioPorLitro
          nuevoPrecio = precioEfectivo;
          nuevoTotal = entrega.total;
        } else {
          // No coincide con ninguno, usar el efectivo como default
          nuevoPrecio = precioEfectivo;
          nuevoTotal = Math.ceil((entrega.litros * precioEfectivo - (entrega.descuento || 0)) / 100) * 100;
          nuevoTotal = Math.max(0, nuevoTotal);
        }

        await db.entrega.update({
          where: { id: entrega.id },
          data: {
            precioPorLitro: nuevoPrecio,
            total: nuevoTotal,
          },
        });
        totalCorregidas++;
        resultados.push(`Corregida entrega ${entrega.id} de ${cliente.nombre}: ${entrega.litros}L, antes $${entrega.total} (precio=$0), ahora $${nuevoTotal} (precio=$${nuevoPrecio})`);
      }
    }

    return NextResponse.json({
      ok: true,
      totalCorregidas,
      resultados,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "fix failed", details: msg }, { status: 500 });
  }
}
