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
  const rangeFilterVuelta = {
    AND: [start ? { iniciadaEn: { gte: start } } : {}, end ? { iniciadaEn: { lt: end } } : {}],
  };

  const [entregas, gastos, vueltas, config] = await Promise.all([
    db.entrega.findMany({ where: rangeFilter }),
    db.gasto.findMany({ where: rangeFilter }),
    db.vuelta.findMany({ where: rangeFilterVuelta, include: { entregas: { select: { id: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, metodoPago: true } } } }),
    db.configuracion.findUnique({ where: { id: "default" } }),
  ]);

  const cfg = config ?? { modoLiquidacion: "porcentaje", montoPorVueltaUnicoCliente: 20000, montoPorVueltaMultiple: 25000, capacidadCamion: 17000 };

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivoRecibido = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferenciaRecibida = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivoRecibido + totalTransferenciaRecibida;
  const totalPorCobrar = entregas.reduce((s, e) => s + Math.max(0, e.total - e.montoRecibido), 0);
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter((g) => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter((g) => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);

  // Gastos por tipo
  const gastosPorTipo: Record<string, number> = {};
  for (const g of gastos) {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
  }

  const utilidadBruta = totalVentas - totalGastos;

  // Vueltas: calcular pago
  let pagoChofer = 0;
  const vueltasResumen = vueltas.map((v) => {
    const numEntregas = v.entregas.length;
    const esMultiple = numEntregas > 1;
    const monto = esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente;
    pagoChofer += monto;
    return {
      id: v.id,
      numero: v.numero,
      cantidadEntregas: numEntregas,
      esMultiple,
      montoPago: monto,
    };
  });

  return NextResponse.json({
    period,
    totalVentas,
    totalEfectivoRecibido,
    totalTransferenciaRecibida,
    totalRecibido,
    totalPorCobrar,
    totalLitros,
    totalGastos,
    gastosChofer,
    gastosDueno,
    gastosPorTipo,
    utilidadBruta,
    cantidadEntregas: entregas.length,
    cantidadGastos: gastos.length,
    cantidadVueltas: vueltas.length,
    pagoChoferCalculado: pagoChofer,
    capacidadCamion: cfg.capacidadCamion,
    modoLiquidacion: cfg.modoLiquidacion,
  });
}
