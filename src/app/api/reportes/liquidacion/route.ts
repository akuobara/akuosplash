import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange, labelTipoGasto } from "@/lib/helpers";

// GET /api/reportes/liquidacion?period=hoy|semana|mes|todo
//
// Dos modos de liquidación:
//
// 1. "porcentaje" (antiguo):
//    utilidadBruta = ventas - gastos
//    parteChofer = utilidadBruta * (%chofer / 100)
//    parteDueno  = utilidadBruta * (%dueno  / 100)
//    saldo = parteChofer - efectivoRecibidoEnRuta
//
// 2. "vuelta" (nuevo):
//    Pago al chofer = suma de pago por vuelta
//      - vuelta con 1 entrega  -> montoPorVueltaUnicoCliente
//      - vuelta con >1 entregas -> montoPorVueltaMultiple
//    Gastos pagados por chofer (reembolsables) = gastos donde pagadoPor = "chofer"
//    Gastos pagados por dueño = gastos donde pagadoPor = "dueno"
//    efectivoRecibidoEnRuta = montoEfectivo de todas las entregas
//    saldo = pagoChofer + gastosPagadosPorChofer - efectivoRecibidoEnRuta
//      (si saldo > 0: dueño le paga al chofer; si < 0: chofer le debe al dueño)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "mes";

  const { start, end } = getRange(period);
  const rangeFilter = {
    AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}],
  };
  const rangeFilterVuelta = {
    AND: [start ? { iniciadaEn: { gte: start } } : {}, end ? { iniciadaEn: { lt: end } } : {}],
  };

  const [entregas, gastos, vueltas, config] = await Promise.all([
    db.entrega.findMany({ where: rangeFilter, orderBy: { fecha: "desc" }, include: { vuelta: true } }),
    db.gasto.findMany({ where: rangeFilter, orderBy: { fecha: "desc" } }),
    db.vuelta.findMany({
      where: rangeFilterVuelta,
      include: { entregas: { select: { id: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, metodoPago: true } } },
      orderBy: { iniciadaEn: "desc" },
    }),
    db.configuracion.findUnique({ where: { id: "default" } }),
  ]);

  const cfg = config ?? {
    nombreChofer: "Chofer",
    nombreDueno: "Dueño del Camión",
    capacidadCamion: 17000,
    modoLiquidacion: "porcentaje",
    porcentajeComisionChofer: 50,
    porcentajeComisionDueno: 50,
    montoPorVueltaUnicoCliente: 20000,
    montoPorVueltaMultiple: 25000,
    precioEfectivoPorLitro: 0,
    precioTransferenciaPorLitro: 0,
  };

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivoRecibido = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferenciaRecibida = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivoRecibido + totalTransferenciaRecibida;
  const totalPorCobrar = totalVentas - totalRecibido;
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter((g) => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter((g) => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);

  const utilidadBruta = totalVentas - totalGastos;

  // --- Calcular según modo ---
  let pagoChofer = 0;
  let pagoDueno = 0;
  let saldoChofer = 0;
  let vueltasDetalle: any[] = [];

  if (cfg.modoLiquidacion === "vuelta") {
    // Para cada vuelta, calcular pago
    vueltasDetalle = vueltas.map((v) => {
      const numEntregas = v.entregas.length;
      const esMultiple = numEntregas > 1;
      const monto = esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente;
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
      const efectivo = v.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
      const transferencia = v.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
      return {
        id: v.id,
        numero: v.numero,
        iniciadaEn: v.iniciadaEn,
        cerradaEn: v.cerradaEn,
        cantidadEntregas: numEntregas,
        esMultiple,
        litros,
        ventas,
        efectivo,
        transferencia,
        montoPago: monto,
      };
    });

    pagoChofer = vueltasDetalle.reduce((s, v) => s + v.montoPago, 0);
    pagoDueno = 0; // en modo vuelta, el dueño no recibe % de utilidad directamente
    // Gastos pagados por chofer son reembolsables
    // Saldo: lo que el dueño le debe al chofer (positivo) o viceversa (negativo)
    saldoChofer = pagoChofer + gastosChofer - totalEfectivoRecibido;
  } else {
    // Modo porcentaje (antiguo)
    pagoChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
    pagoDueno = (utilidadBruta * cfg.porcentajeComisionDueno) / 100;
    saldoChofer = pagoChofer - totalEfectivoRecibido;
  }

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
      totalTransferenciaRecibida,
      totalRecibido,
      totalPorCobrar,
      totalGastos,
      gastosChofer,
      gastosDueno,
      utilidadBruta,
      pagoChofer,
      pagoDueno,
      saldoChofer,
      cantidadVueltas: vueltas.length,
      vueltasUnicoCliente: vueltasDetalle.filter((v) => !v.esMultiple).length,
      vueltasMultiple: vueltasDetalle.filter((v) => v.esMultiple).length,
    },
    vueltas: vueltasDetalle,
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
