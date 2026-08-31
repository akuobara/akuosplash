import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, labelTipoGasto, esVueltaCompletada } from "@/lib/helpers";

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
  const period = searchParams.get("period") || "mes";
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
    db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" }, include: { vuelta: true } }),
    db.gasto.findMany({ where: gastoWhere, orderBy: { fecha: "desc" } }),
    db.vuelta.findMany({
      where: vueltaWhere,
      include: {
        camion: { select: { id: true, nombre: true, patente: true, capacidad: true } },
        chofer: { select: { id: true, nombre: true } },
        entregas: { select: { id: true, litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, metodoPago: true } },
      },
      orderBy: { iniciadaEn: "desc" },
    }),
    db.configuracion.findUnique({ where: { duenoId } }),
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

  // Descuentos: separar por quién asume el costo
  const descuentosChofer = entregas
    .filter((e) => e.descuentoPor === "chofer")
    .reduce((s, e) => s + (e.descuento || 0), 0);
  const descuentosDueno = entregas
    .filter((e) => e.descuentoPor === "dueno")
    .reduce((s, e) => s + (e.descuento || 0), 0);

  const utilidadBruta = totalVentas - totalGastos;

  let pagoChofer = 0;
  let pagoDueno = 0;
  let vueltasDetalle: any[] = [];
  let vueltasExcluidas: any[] = [];

  if (cfg.modoLiquidacion === "vuelta") {
    vueltasDetalle = vueltas.map((v) => {
      const numEntregas = v.entregas.length;
      const esMultiple = numEntregas > 1;
      const monto = esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente;
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
      const efectivo = v.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
      const transferencia = v.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
      const capacidadCamion = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
      const umbral = (cfg as any).umbralCompletacionVuelta || 0.975;
      const completadaAuto = esVueltaCompletada(litros, capacidadCamion, numEntregas, umbral);
      const validadaManualmente = (v as any).validadaManualmente;
      const esValida = validadaManualmente !== null && validadaManualmente !== undefined ? validadaManualmente : completadaAuto;
      return {
        id: v.id, numero: v.numero, iniciadaEn: v.iniciadaEn, cerradaEn: v.cerradaEn,
        camion: v.camion, chofer: v.chofer,
        cantidadEntregas: numEntregas, esMultiple, litros,
        litrosRestantes: Math.max(0, capacidadCamion - litros), capacidadCamion,
        ventas, efectivo, transferencia, montoPago: monto,
        completada: esValida, completadaAuto, validadaManualmente,
        porcentajeCompletado: capacidadCamion > 0 ? (litros / capacidadCamion) * 100 : 0,
      };
    });
    // Separar vueltas válidas de excluidas (con al menos 1 entrega)
    const vueltasValidas = vueltasDetalle.filter((v) => v.completada && v.cantidadEntregas > 0);
    vueltasExcluidas = vueltasDetalle.filter((v) => !v.completada || v.cantidadEntregas === 0);
    vueltasDetalle = vueltasValidas;
    pagoChofer = vueltasValidas.reduce((s, v) => s + v.montoPago, 0);
  } else {
    pagoChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
    pagoDueno = (utilidadBruta * cfg.porcentajeComisionDueno) / 100;
  }

  let baseImponible = 0;
  if (cfg.aplicaImpuestoSobre === "pago_chofer") baseImponible = pagoChofer;
  else if (cfg.aplicaImpuestoSobre === "utilidad_bruta") baseImponible = utilidadBruta;
  else if (cfg.aplicaImpuestoSobre === "ventas_brutas") baseImponible = totalVentas;

  // El impuesto no puede ser negativo (base negativa en meses con pérdida → impuesto 0)
  const baseImponiblePositiva = Math.max(0, baseImponible);
  const impuesto = cfg.tipoTributo === "ninguno" ? 0 : (baseImponiblePositiva * cfg.porcentajeImpuesto) / 100;
  // El pago al chofer no puede ser negativo
  const pagoChoferPositivo = Math.max(0, pagoChofer);
  // El líquido del chofer descuenta los descuentos que él asumió
  const liquidoChoferAntesDeEfectivo = pagoChoferPositivo + gastosChofer - impuesto - descuentosChofer;
  const saldoChofer = liquidoChoferAntesDeEfectivo - totalEfectivoRecibido;

  const gastosPorTipo: Record<string, number> = {};
  for (const g of gastos) {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] ?? 0) + g.monto;
  }

  const porCliente: Record<string, { nombre: string; litros: number; total: number; entregas: number }> = {};
  for (const e of entregas) {
    const key = e.clienteNombre || "Sin nombre";
    if (!porCliente[key]) porCliente[key] = { nombre: key, litros: 0, total: 0, entregas: 0 };
    porCliente[key].litros += e.litros;
    porCliente[key].total += e.total;
    porCliente[key].entregas += 1;
  }
  const topClientes = Object.values(porCliente).sort((a, b) => b.total - a.total).slice(0, 10);

  return NextResponse.json({
    period,
    config: cfg,
    resumen: {
      totalVentas, totalEfectivoRecibido, totalTransferenciaRecibida, totalRecibido,
      totalPorCobrar, totalGastos, gastosChofer, gastosDueno, utilidadBruta,
      descuentosChofer, descuentosDueno,
      pagoChofer, pagoDueno, baseImponible, impuesto, liquidoChoferAntesDeEfectivo,
      saldoChofer,
      cantidadVueltas: vueltas.length,
      vueltasValidas: vueltasDetalle.length,
      vueltasExcluidas: vueltasExcluidas.length,
      vueltasUnicoCliente: vueltasDetalle.filter((v) => !v.esMultiple).length,
      vueltasMultiple: vueltasDetalle.filter((v) => v.esMultiple).length,
    },
    vueltas: vueltasDetalle,
    vueltasExcluidas,
    gastosPorTipo: Object.entries(gastosPorTipo).map(([tipo, monto]) => ({ tipo, label: labelTipoGasto(tipo), monto })),
    topClientes,
    cantidadEntregas: entregas.length,
    cantidadGastos: gastos.length,
    entregas,
    gastos,
  });
}
