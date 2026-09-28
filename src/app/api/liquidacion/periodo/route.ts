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
    umbralCompletacionVuelta: 0.975,
    saldoPendienteLiquidacion: 0,
  };

  const periodo = cfg.periodoLiquidacion || "mensual";

  // Calcular rango del período
  // IMPORTANTE: usar zona horaria de Chile (America/Santiago) para que "hoy"
  // coincida con el día local del usuario, no con el día UTC del servidor.
  // Vercel está en UTC, así que después de las 20:00 Chile (00:00 UTC del día siguiente)
  // el servidor ya cambió de día. Esto causaba que la "semana actual" saltara
  // al domingo siguiente y se perdieran todos los datos del sábado.
  function getPeriodoRange(offsetNum: number): { start: Date; end: Date; label: string } {
    // Obtener "hoy" en zona horaria Chile (UTC-4)
    const nowCL = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    if (periodo === "semanal") {
      // Semana de domingo a sábado. offset=0 = semana actual (la que contiene hoy)
      // offset=-1 = semana anterior, etc.
      const today = new Date(nowCL.getFullYear(), nowCL.getMonth(), nowCL.getDate());
      const todayDow = today.getDay(); // 0=domingo, 1=lunes, ..., 6=sabado
      // Inicio de la semana actual = hoy - todayDow (domingo)
      const startCurrent = new Date(today);
      startCurrent.setDate(today.getDate() - todayDow + 7 * offsetNum);
      // Convertir a UTC pero manteniendo el día Chile (00:00 Chile = 04:00 UTC)
      const start = new Date(Date.UTC(
        startCurrent.getFullYear(),
        startCurrent.getMonth(),
        startCurrent.getDate(),
        4, 0, 0
      ));
      const endCierreCL = new Date(startCurrent);
      endCierreCL.setDate(startCurrent.getDate() + 6); // sábado
      const end = new Date(Date.UTC(
        endCierreCL.getFullYear(),
        endCierreCL.getMonth(),
        endCierreCL.getDate() + 1, // exclusive (domingo siguiente)
        4, 0, 0
      ));
      const label = `Semana ${startCurrent.getDate()}/${startCurrent.getMonth() + 1} - ${endCierreCL.getDate()}/${endCierreCL.getMonth() + 1}/${endCierreCL.getFullYear()}`;
      return { start, end, label };
    } else {
      // Mensual: día 1 al último día del mes
      // offset=0 = mes actual, offset=-1 = mes anterior
      const baseMonth = nowCL.getMonth() + offsetNum;
      const baseYear = nowCL.getFullYear();
      // Ajustar año si el mes se va de rango
      const adjustedDate = new Date(baseYear, baseMonth, 1);
      const start = new Date(Date.UTC(adjustedDate.getFullYear(), adjustedDate.getMonth(), 1, 4, 0, 0));
      const end = new Date(Date.UTC(adjustedDate.getFullYear(), adjustedDate.getMonth() + 1, 1, 4, 0, 0));
      const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
      const label = `${monthNames[adjustedDate.getMonth()]} ${adjustedDate.getFullYear()}`;
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

  // Buscar entregas, gastos, vueltas del período.
  // Para vueltas: usar cerradaEn si la vuelta está cerrada (para que cuente en la semana
  // en que se cerró, no en la que se inició). Si está activa, usar iniciadaEn.
  // Esto resuelve el caso de una vuelta que se inició la semana pasada pero se cerró esta semana.
  const [entregas, gastos, vueltas, pagosSueltos] = await Promise.all([
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
      where: {
        duenoId,
        OR: [
          // Vueltas cerradas en este período
          { activa: false, cerradaEn: { gte: start, lt: end } },
          // Vueltas activas iniciadas en este período
          { activa: true, iniciadaEn: { gte: start, lt: end } },
        ],
      },
      include: {
        camion: { select: { nombre: true, capacidad: true } },
        chofer: { select: { nombre: true } },
        entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, estadoPago: true, fecha: true } },
      },
      orderBy: { iniciadaEn: "desc" },
    }),
    db.pago.findMany({
      where: { duenoId, fecha: { gte: start, lt: end } },
      orderBy: { fecha: "desc" },
      include: { cliente: { select: { nombre: true } } },
    }),
  ]);

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivo + totalTransferencia;
  // Pagos recibidos (cobros de deudas) - se recalcula abajo excluyendo cobros de saldo
  // Efectivo total = efectivo de entregas + TODOS los pagos sueltos en efectivo del período.
  // No filtrar por choferId: si el chofer es el único trabajando, todo el efectivo
  // lo recibió él. Los pagos sin choferId (registrados por admin o sin asignar)
  // también cuentan porque el efectivo físico está en manos del chofer.
  const esChofer = session.role === "chofer";
  // === COBROS DE SALDO ANTERIOR ===
  // Estrategia robusta (no depende solo del texto de la descripcion):
  //   1) Primary: la columna `esCobroSaldoAnterior` (agregada por
  //      /api/admin/migrate-saldo-cobro). Si la columna todavía no existe en
  //      la DB de producción, el query crashea y caemos al fallback.
  //   2) Fallback: filtro por texto sobre la descripcion del pago.
  //   3) Backup extra: también checkeamos GASTOS con patron de cobro de saldo
  //      (porque en intentos previos el cobro se registraba como GASTO, no PAGO;
  //      si quedó un gasto fantasma, queremos detectarlo igual para ocultar
  //      el botón y no confundir al usuario).
  const esCobroSaldoAnterior = (descripcion: string | null) => {
    if (!descripcion) return false;
    const d = descripcion.toLowerCase();
    return (
      d.includes("cobro de saldo anterior") ||
      d.includes("pago de saldo") ||
      (d.includes("saldo") && (d.includes("anterior") || d.includes("liquidación") || d.includes("liquidacion")))
    );
  };

  // IDs de pagos marcados como esCobroSaldoAnterior=1 (vía flag estructural).
  // Si la columna no existe todavía, este query falla y usamos solo texto.
  let idsFlagged: Set<string> = new Set();
  try {
    const flaggedRows: Array<{ id: string }> = await db.$queryRawUnsafe(
      `SELECT "id" FROM "Pago" WHERE "esCobroSaldoAnterior" = 1 AND "duenoId" = ? AND "fecha" >= ? AND "fecha" < ?;`,
      duenoId,
      start.toISOString(),
      end.toISOString()
    );
    idsFlagged = new Set(flaggedRows.map((r) => r.id));
  } catch {
    // La columna no existe todavía (migración pendiente). No problemo.
  }
  const esCobroSaldoAnteriorPago = (p: (typeof pagosSueltos)[number]) =>
    idsFlagged.has(p.id) || esCobroSaldoAnterior(p.descripcion);

  const cobrosSaldoAnterior = pagosSueltos.filter(p => esCobroSaldoAnteriorPago(p));
  const cobroSaldoAnteriorEfectivo = cobrosSaldoAnterior
    .filter(p => p.metodoPago === "efectivo")
    .reduce((s, p) => s + p.monto, 0);
  const cobroSaldoAnteriorTransferencia = cobrosSaldoAnterior
    .filter(p => p.metodoPago === "transferencia")
    .reduce((s, p) => s + p.monto, 0);
  const cobroSaldoAnteriorTotal = cobroSaldoAnteriorEfectivo + cobroSaldoAnteriorTransferencia;
  // Pagos recibidos que NO son cobros de saldo anterior
  const pagosSueltosReales = pagosSueltos.filter(p => !esCobroSaldoAnteriorPago(p));
  const totalPagosSueltos = pagosSueltosReales.reduce((s, p) => s + p.monto, 0);
  const pagosSueltosEfectivoChofer = pagosSueltosReales
    .filter(p => p.metodoPago === "efectivo")
    .reduce((s, p) => s + p.monto, 0);
  const pagosSueltosEfectivo = pagosSueltosEfectivoChofer;
  const pagosSueltosTransferencia = pagosSueltosReales.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);
  // Efectivo total = efectivo de entregas + efectivo de pagos recibidos (excluyendo cobros de saldo)
  const efectivoTotal = totalEfectivo + pagosSueltosEfectivo;
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  // Detectar también GASTOS fantasma que sean cobros de saldo (de intentos previos
  // cuando pagar-saldo creaba un GASTO en vez de un PAGO). Estos no deberían
  // contar para la liquidación pero SI deben ocultar el botón "Cobrar saldo anterior".
  // Saldo arrastrado del período anterior (lo que el dueno le debía al chofer)
  const saldoArrastradoRaw = (cfg as any).saldoPendienteLiquidacion || 0;
  // Detectar también GASTOS fantasma que sean cobros de saldo (de intentos previos
  // cuando pagar-saldo creaba un GASTO en vez de un PAGO). Estos no deberían
  // contar para la liquidación pero SI deben ocultar el botón "Cobrar saldo anterior".
  const cobroSaldoAnteriorGastoMonto = gastos
    .filter(g => esCobroSaldoAnterior(g.descripcion) || (saldoArrastradoRaw > 0 && g.monto === saldoArrastradoRaw))
    .reduce((s, g) => s + g.monto, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter(g => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);
  const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
  const utilidadBruta = totalVentas - totalGastos;

  // Pago al chofer según modo
  let pagoChofer = 0;
  let vueltasValidas: typeof vueltas = [];
  let vueltasUnicoCliente = 0;
  let vueltasMultiple = 0;
  if (cfg.modoLiquidacion === "vuelta") {
    vueltasValidas = vueltas.filter(v => {
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const cap = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
      return esVueltaCompletada(litros, cap, v.entregas.length, cfg.umbralCompletacionVuelta ?? 0.975, (v as any).validadaManualmente);
    });
    // Contar tipos de vueltas válidas
    vueltasUnicoCliente = vueltasValidas.filter(v => v.entregas.length <= 1).length;
    vueltasMultiple = vueltasValidas.filter(v => v.entregas.length > 1).length;
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
  // El saldo del chofer descuenta TODO el efectivo que tiene en mano (entregas + pagos recibidos)
  // + suma el saldo pendiente de la liquidación anterior (arrastrado)
  // === CÁLCULO DEL SALDO CHOFER ===
  //
  // saldoChofer = liquidoChofer - efectivoTotal
  //
  // La liquidación de CADA período es INDEPENDIENTE del período anterior.
  // El saldoArrastrado y los cobros de saldo anterior NO se mezclan con esta semana:
  // - El saldoArrastrado es deuda de la liquidación PASADA, se muestra en una sección aparte.
  // - Los cobros de saldo anterior son pagos hacia esa deuda pasada, también en sección aparte.
  // - El saldoChofer de esta semana = solo lo que el dueno le debe al chofer por el trabajo DE ESTA semana.
  //
  // Importante: efectivoTotal EXCLUYE los cobros de saldo anterior, porque esos cobros son
  // movimientos hacia deuda pasada, no efectivo de esta semana.
  const saldoArrastrado = saldoArrastradoRaw;
  // Saldo pendiente del período anterior (después de cobros de este período):
  //   - Si cobro >= saldoArrastrado: 0 (deuda pasada totalmente cancelada)
  //   - Si cobro < saldoArrastrado: lo que falta cobrar
  const saldoAnteriorPendiente = Math.max(0, saldoArrastrado - cobroSaldoAnteriorTotal);
  // Total global que el dueno le debe al chofer (esta semana + saldo anterior pendiente)
  // = saldoChofer (esta semana) + saldoAnteriorPendiente
  // Esto se muestra aparte para que el usuario vea el total pero sin contaminar el cálculo semanal.
  const saldoChofer = liquidoChofer - efectivoTotal;
  const saldoChoferTotal = saldoChofer + saldoAnteriorPendiente;
  // ¿Ya se cobró el saldo anterior este período?
  // True si hay PAGO de cobro de saldo anterior, o GASTO fantasma con descripción de cobro.
  const saldoCobrado = cobroSaldoAnteriorTotal > 0 || cobroSaldoAnteriorGastoMonto > 0;

  // Detalle de vueltas para la liquidación
  const vueltasDetalle = vueltas.map(v => {
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
    const efectivo = v.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const transf = v.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
    const cap = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
    const completada = esVueltaCompletada(litros, cap, v.entregas.length, cfg.umbralCompletacionVuelta ?? 0.975, (v as any).validadaManualmente);
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
      vueltasUnicoCliente,
      vueltasMultiple,
      // Pagos sueltos
      totalPagosSueltos,
      pagosSueltosEfectivo,
      pagosSueltosTransferencia,
      efectivoTotal,
      saldoArrastrado,
      saldoCobrado,
      cobroSaldoAnteriorTotal,
      cobroSaldoAnteriorEfectivo,
      cobroSaldoAnteriorTransferencia,
      cobroSaldoAnteriorGastoMonto,
      // Saldo anterior pendiente (después de cobros) — lo que el dueno aún le debe del período pasado
      saldoAnteriorPendiente,
      // Total global = saldoChofer (esta semana) + saldoAnteriorPendiente (período anterior)
      saldoChoferTotal,
    },
    pagosSueltos: pagosSueltosReales.map(p => ({
      id: p.id,
      fecha: p.fecha,
      cliente: p.cliente?.nombre || p.descripcion || "Sin cliente",
      monto: p.monto,
      metodoPago: p.metodoPago,
      nota: p.nota,
    })),
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
  }, {
    headers: {
      // Evitar cache — el usuario siempre debe ver el estado actualizado
      // (sin esto, el navegador puede mostrar saldoArrastrado viejo)
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}
