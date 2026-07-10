import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange } from "@/lib/helpers";

// GET /api/reportes/resumen?period=hoy|semana|mes|todo
// Devuelve un resumen agregado para el dashboard.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "hoy";

  const { start, end } = getRange(period);
  const rangeFilter = {
    AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}],
  };

  const [entregas, gastos] = await Promise.all([
    db.entrega.findMany({ where: rangeFilter }),
    db.gasto.findMany({ where: rangeFilter }),
  ]);

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivoRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPorCobrar = entregas.reduce(
    (s, e) => s + Math.max(0, e.total - e.montoRecibido),
    0
  );
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  // Gastos por tipo
  const gastosPorTipo: Record<string, number> = {};
  for (const g of gastos) {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
  }

  // Utilidad bruta = ventas - gastos
  const utilidadBruta = totalVentas - totalGastos;

  return NextResponse.json({
    period,
    totalVentas,
    totalEfectivoRecibido,
    totalPorCobrar,
    totalLitros,
    totalGastos,
    gastosPorTipo,
    utilidadBruta,
    cantidadEntregas: entregas.length,
    cantidadGastos: gastos.length,
  });
}
