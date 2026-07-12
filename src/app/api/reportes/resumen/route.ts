import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "hoy";
  const { start, end } = getRange(period);

  const rangeFilter = {
    AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}],
  };
  const rangeFilterVuelta = {
    AND: [start ? { iniciadaEn: { gte: start } } : {}, end ? { iniciadaEn: { lt: end } } : {}],
  };

  const entregaWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const gastoWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const vueltaWhere = { ...rangeFilterVuelta, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };

  const [entregas, gastos, vueltas, config] = await Promise.all([
    db.entrega.findMany({ where: entregaWhere }),
    db.gasto.findMany({ where: gastoWhere }),
    db.vuelta.findMany({
      where: vueltaWhere,
      include: { entregas: { select: { id: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true } } },
    }),
    db.configuracion.findUnique({ where: { duenoId } }),
  ]);

  const cfg = config ?? {
    modoLiquidacion: "porcentaje",
    montoPorVueltaUnicoCliente: 20000,
    montoPorVueltaMultiple: 25000,
    capacidadCamion: 17000,
  };

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivoRecibido = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferenciaRecibida = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivoRecibido + totalTransferenciaRecibida;
  const totalPorCobrar = entregas.reduce((s, e) => s + Math.max(0, e.total - e.montoRecibido), 0);
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter((g) => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter((g) => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);

  const gastosPorTipo: Record<string, number> = {};
  for (const g of gastos) {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
  }

  const utilidadBruta = totalVentas - totalGastos;

  let pagoChofer = 0;
  const vueltasResumen = vueltas.map((v) => {
    const numEntregas = v.entregas.length;
    const esMultiple = numEntregas > 1;
    const monto = esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente;
    // Solo acumular pagoChofer si el modo de liquidación es "vuelta"
    if (cfg.modoLiquidacion === "vuelta") {
      pagoChofer += monto;
    }
    return { id: v.id, numero: v.numero, cantidadEntregas: numEntregas, esMultiple, montoPago: monto };
  });

  // En modo porcentaje, calcular pagoChofer como porcentaje de utilidad
  if (cfg.modoLiquidacion !== "vuelta") {
    pagoChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
  }

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
