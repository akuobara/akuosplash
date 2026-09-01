import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { formatCurrency, formatNumber, formatDate, labelModoLiquidacion, esVueltaCompletada } from "@/lib/helpers";

// GET /api/liquidacion/periodo?offset=0
// offset=0 = periodo actual, offset=-1 = periodo anterior, etc.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const offset = Number(searchParams.get("offset") || 0);

  const config = await db.configuracion.findUnique({ where: { duenoId } });
  const cfg = config ?? {
    modoLiquidacion: "porcentaje",
    porcentajeComisionChofer: 50,
    porcentajeComisionDueno: 50,
    montoPorVueltaUnicoCliente: 20000,
    montoPorVueltaMultiple: 25000,
    capacidadCamion: 17000,
    tipoTributo: "ninguno",
    porcentajeImpuesto: 0,
    aplicaImpuestoSobre: "pago_chofer",
    periodoLiquidacion: "mensual",
    diaCierreMes: 0,
    diaCierreSemana: 6,
    nombreDueno: "Dueño",
    nombreChofer: "Chofer",
  };

  const periodo = cfg.periodoLiquidacion || "mensual";

  // Calcular rango del período
  function getPeriodoRange(offsetNum: number): { start: Date; end: Date; label: string } {
    const now = new Date();
    if (periodo === "semanal") {
      // Semana domingo a sábado. offset=-1 = semana anterior
      const diaCierre = cfg.diaCierreSemana ?? 6; // 6 = sábado
      // Encontrar el último día de cierre <= hoy
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayDow = today.getDay();
      let diff = todayDow - diaCierre;
      if (diff < 0) diff += 7;
      const endCierre = new Date(today);
      endCierre.setDate(today.getDate() - diff + 7 * offsetNum);
      const start = new Date(endCierre);
      start.setDate(endCierre.getDate() - 6);
      const end = new Date(endCierre);
      end.setDate(endCierre.getDate() + 1); // exclusive
      const label = `Semana ${start.getDate()}/${start.getMonth() + 1} - ${endCierre.getDate()}/${endCierre.getMonth() + 1}/${endCierre.getFullYear()}`;
      return { start, end, label };
    } else {
      // Mensual: día 1 al último día del mes
      // offset=0 = mes actual, offset=-1 = mes anterior
      const baseMonth = now.getMonth() + offsetNum;
      const baseYear = now.getFullYear();
      const start = new Date(baseYear, baseMonth, 1);
      const end = new Date(baseYear, baseMonth + 1, 1);
      const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const label = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;
      return { start, end, label };
    }
  }

  const { start, end, label } = getPeriodoRange(offset);

  // Generar historial de periodos (últimos 12)
  const historial: { offset: number; label: string; start: Date; end: Date }[] = [];
  for (let i = -11; i <= 0; i++) {
    const p = getPeriodoRange(i);
    historial.push({ offset: i, label: p.label, start: p.start, end: p.end });
  }

  // Buscar entregas, gastos, vueltas del período
  const [entregas, gastos, vueltas] = await Promise.all([
    db.entrega.findMany({
      where: { duenoId, fecha: { gte: start, lt: end } },
      orderBy: { fecha: "desc" },
      include: { vuelta: { select: { numero: true, camion: { select: { nombre: true } }, chofer: { select: { nombre: true } } } } },
    }),
    db.gasto.findMany({
      where: { duenoId, fecha: { gte: start, lt: end } },
      orderBy: { fecha: "desc" },
    }),
    db.vuelta.findMany({
      where: { duenoId, iniciadaEn: { gte: start, lt: end } },
      include: {
        camion: { select: { nombre: true, capacidad: true } },
        chofer: { select: { nombre: true } },
        entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, estadoPago: true, fecha: true } },
      },
      orderBy: { iniciadaEn: "desc" },
    }),
  ]);

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivo + totalTransferencia;
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter(g => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);
  const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
  const utilidadBruta = totalVentas - totalGastos;

  // Pago al chofer según modo
  let pagoChofer = 0;
  let vueltasValidas: typeof vueltas = [];
  if (cfg.modoLiquidacion === "vuelta") {
    vueltasValidas = vueltas.filter(v => {
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const cap = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
      return esVueltaCompletada(litros, cap, v.entregas.length);
    });
    pagoChofer = vueltasValidas.reduce((s, v) => {
      const esMultiple = v.entregas.length > 1;
      return s + (esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente);
    }, 0);
  } else {
    pagoChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
  }

  const baseImponible = cfg.aplicaImpuestoSobre === "pago_chofer" ? pagoChofer : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? utilidadBruta : totalVentas;
  const impuesto = cfg.tipoTributo === "ninguno" ? 0 : (Math.max(0, baseImponible) * cfg.porcentajeImpuesto) / 100;
  const liquidoChofer = Math.max(0, pagoChofer) + gastosChofer - impuesto - descuentosChofer;
  const saldoChofer = liquidoChofer - totalEfectivo;

  // Detalle de vueltas para la liquidación
  const vueltasDetalle = vueltas.map(v => {
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
    const efectivo = v.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const transf = v.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
    const cap = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
    const completada = esVueltaCompletada(litros, cap, v.entregas.length);
    const pagoVuelta = cfg.modoLiquidacion === "vuelta" && completada
      ? (v.entregas.length > 1 ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente)
      : 0;
    return {
      id: v.id,
      numero: v.numero,
      iniciadaEn: v.iniciadaEn,
      cerradaEn: v.cerradaEn,
      camion: v.camion?.nombre || "—",
      chofer: v.chofer?.nombre || "—",
      cantidadEntregas: v.entregas.length,
      litros,
      ventas,
      efectivo,
      transferencia: transf,
      completada,
      pagoVuelta,
    };
  });

  return NextResponse.json({
    periodo: {
      tipo: periodo,
      label,
      start: start.toISOString(),
      end: end.toISOString(),
      offset,
    },
    historial,
    config: {
      modoLiquidacion: cfg.modoLiquidacion,
      porcentajeComisionChofer: cfg.porcentajeComisionChofer,
      porcentajeComisionDueno: cfg.porcentajeComisionDueno,
      montoPorVueltaUnicoCliente: cfg.montoPorVueltaUnicoCliente,
      montoPorVueltaMultiple: cfg.montoPorVueltaMultiple,
      tipoTributo: cfg.tipoTributo,
      porcentajeImpuesto: cfg.porcentajeImpuesto,
      aplicaImpuestoSobre: cfg.aplicaImpuestoSobre,
      periodoLiquidacion: cfg.periodoLiquidacion,
      diaCierreMes: cfg.diaCierreMes,
      diaCierreSemana: cfg.diaCierreSemana,
    },
    resumen: {
      totalVentas,
      totalEfectivo,
      totalTransferencia,
      totalRecibido,
      totalLitros,
      totalEntregas: entregas.length,
      totalGastos,
      gastosChofer,
      gastosDueno,
      descuentosChofer,
      utilidadBruta,
      pagoChofer,
      impuesto,
      liquidoChofer,
      saldoChofer,
      vueltasCompletadas: vueltasValidas.length,
      vueltasTotal: vueltas.length,
    },
    vueltas: vueltasDetalle,
    entregas: entregas.map(e => ({
      id: e.id,
      fecha: e.fecha,
      cliente: e.clienteNombre,
      litros: e.litros,
      total: e.total,
      montoEfectivo: e.montoEfectivo,
      montoTransferencia: e.montoTransferencia,
      montoRecibido: e.montoRecibido,
      estadoPago: e.estadoPago,
      metodoPago: e.metodoPago,
      vuelta: e.vuelta?.numero,
    })),
    gastos: gastos.map(g => ({
      id: g.id,
      fecha: g.fecha,
      tipo: g.tipo,
      descripcion: g.descripcion,
      monto: g.monto,
      pagadoPor: g.pagadoPor,
    })),
  });
}
