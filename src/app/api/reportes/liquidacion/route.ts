import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange, labelTipoGasto } from "@/lib/helpers";

// GET /api/reportes/liquidacion?period=hoy|semana|mes|todo
// Calcula la liquidación entre el chofer y el dueño del camión.
//
// Fórmula:
//   utilidadBruta = totalVentas - totalGastos
//   parteChofer   = utilidadBruta * (%chofer / 100)
//   parteDueno    = utilidadBruta * (%dueno / 100)
//   montoAPagarAlDueno = parteDueno  (si utilidad positiva; si es negativa, lo absorbe según acuerdo)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "mes";

  const { start, end } = getRange(period);
  const rangeFilter = {
    AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}],
  };

  const [entregas, gastos, config] = await Promise.all([
    db.entrega.findMany({ where: rangeFilter, orderBy: { fecha: "desc" } }),
    db.gasto.findMany({ where: rangeFilter, orderBy: { fecha: "desc" } }),
    db.configuracion.findUnique({ where: { id: "default" } }),
  ]);

  const cfg = config ?? {
    nombreChofer: "Chofer",
    nombreDueno: "Dueño del Camión",
    porcentajeComisionChofer: 50,
    porcentajeComisionDueno: 50,
    precioPorLitroDefault: 0,
  };

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivoRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPorCobrar = totalVentas - totalEfectivoRecibido;
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  const utilidadBruta = totalVentas - totalGastos;

  const parteChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
  const parteDueno = (utilidadBruta * cfg.porcentajeComisionDueno) / 100;

  // Si el chofer recibió efectivo, descuenta lo que ya tiene:
  //   efectivoRecibido es lo que el chofer cobró en ruta.
  //   si parteChofer > efectivoRecibido, el dueño le debe la diferencia.
  //   si parteChofer < efectivoRecibido, el chofer le debe al dueño.
  const saldoChofer = parteChofer - totalEfectivoRecibido;

  // Gastos por tipo (para detalle)
  const gastosPorTipo: Record<string, number> = {};
  for (const g of gastos) {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
  }

  // Top clientes por venta en el período
  const porCliente: Record<string, { nombre: string; litros: number; total: number; entregas: number }> = {};
  for (const e of entregas) {
    const key = e.clienteNombre || "Sin nombre";
    if (!porCliente[key]) {
      porCliente[key] = { nombre: key, litros: 0, total: 0, entregas: 0 };
    }
    porCliente[key].litros += e.litros;
    porCliente[key].total += e.total;
    porCliente[key].entregas += 1;
  }
  const topClientes = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 10);

  return NextResponse.json({
    period,
    config: cfg,
    resumen: {
      totalVentas,
      totalEfectivoRecibido,
      totalPorCobrar,
      totalGastos,
      utilidadBruta,
      parteChofer,
      parteDueno,
      saldoChofer,
    },
    gastosPorTipo: Object.entries(gastosPorTipo).map(([tipo, monto]) => ({
      tipo,
      label: labelTipoGasto(tipo),
      monto,
    })),
    topClientes,
    cantidadEntregas: entregas.length,
    cantidadGastos: gastos.length,
    entregas,
    gastos,
  });
}
