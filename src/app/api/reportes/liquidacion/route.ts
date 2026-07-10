import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange, labelTipoGasto } from "@/lib/helpers";

// GET /api/reportes/liquidacion?period=hoy|semana|mes|todo
//
// Dos modos de liquidación + cálculo de impuestos.
//
// Modo "porcentaje":
//   utilidadBruta = ventas - gastos
//   pagoChofer = utilidadBruta * (%chofer / 100)
//   pagoDueno  = utilidadBruta * (%dueno  / 100)
//
// Modo "vuelta":
//   pagoChofer = suma de pago por vuelta
//   (1 entrega -> montoPorVueltaUnicoCliente; >1 -> montoPorVueltaMultiple)
//
// Impuestos:
//   baseImponible = depende de aplicaImpuestoSobre:
//     - "pago_chofer" -> pagoChofer
//     - "utilidad_bruta" -> utilidadBruta
//     - "ventas_brutas" -> totalVentas
//   impuesto = baseImponible * (porcentajeImpuesto / 100)
//   liquidoChofer = pagoChofer - impuesto  (solo si base es pago_chofer)
//
// Saldo final:
//   saldo = (pagoChofer + gastosChofer) - efectivoRecibidoEnRuta - impuesto
//   (si baseImponible es pago_chofer o utilidad_bruta, el impuesto se descuenta del chofer)
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
      include: {
        camion: { select: { id: true, nombre: true, patente: true, capacidad: true } },
        entregas: { select: { id: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, metodoPago: true } },
      },
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
    tipoTributo: "boleta_honorarios",
    porcentajeImpuesto: 15.25,
    aplicaImpuestoSobre: "pago_chofer",
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

  let pagoChofer = 0;
  let pagoDueno = 0;
  let vueltasDetalle: any[] = [];

  if (cfg.modoLiquidacion === "vuelta") {
    vueltasDetalle = vueltas.map((v) => {
      const numEntregas = v.entregas.length;
      const esMultiple = numEntregas > 1;
      const monto = esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente;
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
      const efectivo = v.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
      const transferencia = v.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
      const capacidadCamion = v.camion?.capacidad ?? 0;
      return {
        id: v.id,
        numero: v.numero,
        iniciadaEn: v.iniciadaEn,
        cerradaEn: v.cerradaEn,
        camion: v.camion,
        cantidadEntregas: numEntregas,
        esMultiple,
        litros,
        litrosRestantes: Math.max(0, capacidadCamion - litros),
        capacidadCamion,
        ventas,
        efectivo,
        transferencia,
        montoPago: monto,
      };
    });

    pagoChofer = vueltasDetalle.reduce((s, v) => s + v.montoPago, 0);
    pagoDueno = 0;
  } else {
    pagoChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
    pagoDueno = (utilidadBruta * cfg.porcentajeComisionDueno) / 100;
  }

  // ===== Cálculo de impuestos =====
  let baseImponible = 0;
  if (cfg.aplicaImpuestoSobre === "pago_chofer") baseImponible = pagoChofer;
  else if (cfg.aplicaImpuestoSobre === "utilidad_bruta") baseImponible = utilidadBruta;
  else if (cfg.aplicaImpuestoSobre === "ventas_brutas") baseImponible = totalVentas;

  const impuesto = cfg.tipoTributo === "ninguno" ? 0 : (baseImponible * cfg.porcentajeImpuesto) / 100;

  // Saldo del chofer (lo que recibe o debe):
  //   pagoChofer (bruto) + reembolso de gastos que pagó el chofer − impuesto retenido − efectivo ya recibido
  const liquidoChoferAntesDeEfectivo = pagoChofer + gastosChofer - impuesto;
  const saldoChofer = liquidoChoferAntesDeEfectivo - totalEfectivoRecibido;

  // Gastos por tipo
  const gastosPorTipo: Record<string, number> = {};
  for (const g of gastos) {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
  }

  // Top clientes por venta
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
      baseImponible,
      impuesto,
      liquidoChoferAntesDeEfectivo,
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
