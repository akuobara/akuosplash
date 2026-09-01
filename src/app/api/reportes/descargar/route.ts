// Genera un resumen diario simple en PDF o Excel
// GET /api/reportes/descargar?tipo=simple|completo&formato=pdf|excel&period=...
//
// Resumen simple (4 secciones):
//   1. Ventas — totales del día
//   2. Efectivo / pagos recibidos — desglose de cobros
//   3. Clientes con cantidad entregada — listado por cliente
//   4. Gastos — del día
//
// Resumen completo (agrega):
//   5. Pagos pendientes por cliente (saldo histórico)
//   6. Liquidación del chofer
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, formatCurrency, formatNumber, formatDate, formatDateTime, formatNowCL, labelTipoGasto, labelMetodoPago, labelEstadoPago, labelModoLiquidacion, esVueltaCompletada } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get("tipo") || "simple";
  const formato = searchParams.get("formato") || "pdf";
  const period = searchParams.get("period") || "hoy";
  const { start, end } = getRange(period);

  const rangeFilter = { AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}] };
  const rangeFilterVuelta = { AND: [start ? { iniciadaEn: { gte: start } } : {}, end ? { iniciadaEn: { lt: end } } : {}] };
  const entregaWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const gastoWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const vueltaWhere = { ...rangeFilterVuelta, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const pagoWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };

  const [entregas, gastos, vueltas, pagos, clientes, config] = await Promise.all([
    db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" }, include: { vuelta: { select: { numero: true } }, cliente: { select: { nombre: true, telefono: true, zona: true, direccion: true } } } }),
    db.gasto.findMany({ where: gastoWhere, orderBy: { fecha: "desc" } }),
    db.vuelta.findMany({ where: vueltaWhere, include: { camion: { select: { nombre: true, capacidad: true } }, chofer: { select: { nombre: true } }, entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, metodoPago: true, estadoPago: true, fecha: true, descuento: true } } }, orderBy: { iniciadaEn: "desc" } }),
    db.pago.findMany({ where: pagoWhere, orderBy: { fecha: "desc" }, include: { cliente: { select: { nombre: true } } } }),
    db.cliente.findMany({ where: { duenoId }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, telefono: true, zona: true, direccion: true, _count: { select: { entregas: true } } } }),
    db.configuracion.findUnique({ where: { duenoId } }),
  ]);

  const cfg = config ?? { nombreDueno: "Dueño", nombreChofer: "Chofer", capacidadCamion: 17000, modoLiquidacion: "porcentaje", porcentajeComisionChofer: 50, porcentajeComisionDueno: 50, montoPorVueltaUnicoCliente: 20000, montoPorVueltaMultiple: 25000, tipoTributo: "ninguno", porcentajeImpuesto: 0, aplicaImpuestoSobre: "pago_chofer" };

  // === CÁLCULOS ===
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivo + totalTransferencia;
  const totalPorCobrar = totalVentas - totalRecibido;
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter(g => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);

  const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
  const pagosSueltosEfectivo = pagos.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0);
  const pagosSueltosTransferencia = pagos.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);

  // === TOTAL EFECTIVO + PAGOS RECIBIDOS ===
  const efectivoTotal = totalEfectivo + pagosSueltosEfectivo;
  const transferenciaTotal = totalTransferencia + pagosSueltosTransferencia;
  const totalCobrado = efectivoTotal + transferenciaTotal;

  // === CLIENTES CON CANTIDAD ENTREGADA (agrupar entregas por cliente) ===
  const clientesMap = new Map<string, { nombre: string; litros: number; ventas: number; recibido: number; saldo: number; entregas: number }>();
  for (const e of entregas) {
    const key = e.clienteId || e.clienteNombre || "Sin cliente";
    const existing = clientesMap.get(key) ?? { nombre: e.clienteNombre, litros: 0, ventas: 0, recibido: 0, saldo: 0, entregas: 0 };
    existing.litros += e.litros;
    existing.ventas += e.total;
    existing.recibido += e.montoRecibido;
    existing.saldo += Math.max(0, e.total - e.montoRecibido);
    existing.entregas += 1;
    clientesMap.set(key, existing);
  }
  const clientesEntrega = Array.from(clientesMap.values()).sort((a, b) => b.ventas - a.ventas);

  // === Pagos pendientes por cliente (saldo histórico) — solo en modo completo ===
  const clienteIds = new Set<string>(clientes.map(c => c.id));
  const saldosPorCliente = new Map<string, { nombre: string; telefono: string | null; zona: string | null; direccion: string | null; totalVentas: number; totalRecibido: number; pagosSueltos: number; saldo: number }>();

  const entregasHistoricas = await db.entrega.findMany({
    where: { duenoId, clienteId: { in: Array.from(clienteIds) } },
    select: { clienteId: true, total: true, montoRecibido: true },
  });
  const pagosHistoricos = await db.pago.findMany({
    where: { duenoId, clienteId: { in: Array.from(clienteIds) } },
    select: { clienteId: true, monto: true },
  });

  for (const c of clientes) {
    saldosPorCliente.set(c.id, {
      nombre: c.nombre, telefono: c.telefono, zona: c.zona, direccion: c.direccion,
      totalVentas: 0, totalRecibido: 0, pagosSueltos: 0, saldo: 0,
    });
  }
  for (const e of entregasHistoricas) {
    if (!e.clienteId) continue;
    const s = saldosPorCliente.get(e.clienteId);
    if (!s) continue;
    s.totalVentas += e.total;
    s.totalRecibido += e.montoRecibido;
  }
  for (const p of pagosHistoricos) {
    const s = saldosPorCliente.get(p.clienteId);
    if (!s) continue;
    s.pagosSueltos += p.monto;
  }
  for (const s of saldosPorCliente.values()) {
    s.saldo = Math.max(0, s.totalVentas - s.totalRecibido - s.pagosSueltos);
  }
  const clientesConSaldo = Array.from(saldosPorCliente.values()).filter(s => s.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const totalSaldoPendiente = clientesConSaldo.reduce((s, c) => s + c.saldo, 0);

  // Liquidación (solo completo)
  const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
  const utilidadBruta = totalVentas - totalGastos;
  let pagoChofer = 0;
  if (cfg.modoLiquidacion === "vuelta") {
    const vueltasValidas = vueltas.filter(v => {
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

  const periodLabel = period.startsWith("custom:") ? `${period.split(":")[1]} a ${period.split(":")[2]}` : period;

  const data = {
    entregas, gastos, vueltas, pagos, clientes: clientesConSaldo, clientesEntrega, cfg,
    totalVentas, totalEfectivo, totalTransferencia, totalRecibido, totalPorCobrar,
    totalLitros, totalGastos, gastosChofer, gastosDueno, descuentosChofer, utilidadBruta,
    pagoChofer, impuesto, liquidoChofer, saldoChofer,
    totalPagosSueltos, pagosSueltosEfectivo, pagosSueltosTransferencia,
    efectivoTotal, transferenciaTotal, totalCobrado,
    totalSaldoPendiente,
  };

  if (formato === "excel") {
    return generarExcel(tipo, periodLabel, data);
  }
  return generarPDF(tipo, periodLabel, data);
}

function generarPDF(tipo: string, period: string, data: any) {
  const { jsPDF } = require("jspdf");
  const autoTable = require("jspdf-autotable");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Encabezado
  doc.setFontSize(18);
  doc.text("Resumen Diario", 14, 18);
  doc.setFontSize(10);
  doc.text(`Periodo: ${period}`, 14, 25);
  doc.text(`Generado: ${formatNowCL()} (hora Chile)`, 14, 30);
  doc.text(`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`, 14, 35);

  let y = 42;

  // === 1. VENTAS ===
  doc.setFontSize(14);
  doc.text("1. Ventas", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Total ventas", formatCurrency(data.totalVentas)],
      ["Litros entregados", `${formatNumber(data.totalLitros, 0)} L`],
      ["Cantidad de entregas", String(data.entregas.length)],
      ["Vueltas", String(data.vueltas.length)],
      ["Por cobrar del día (saldo)", formatCurrency(data.totalPorCobrar)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 2. EFECTIVO / PAGOS RECIBIDOS ===
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text("2. Efectivo / pagos recibidos", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Efectivo (entregas + pagos sueltos)", formatCurrency(data.efectivoTotal)],
      ["  · Efectivo en entregas", formatCurrency(data.totalEfectivo)],
      ["  · Efectivo en pagos sueltos", formatCurrency(data.pagosSueltosEfectivo)],
      ["Transferencia (entregas + pagos sueltos)", formatCurrency(data.transferenciaTotal)],
      ["  · Transferencia en entregas", formatCurrency(data.totalTransferencia)],
      ["  · Transferencia en pagos sueltos", formatCurrency(data.pagosSueltosTransferencia)],
      ["TOTAL cobrado", formatCurrency(data.totalCobrado)],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
    foot: [["", ""]],
    footStyles: { fillColor: [16, 185, 129] },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 3. CLIENTES CON CANTIDAD ENTREGADA ===
  if (data.clientesEntrega.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text(`3. Clientes con cantidad entregada (${data.clientesEntrega.length})`, 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Entregas", "Litros", "Total vendido", "Recibido", "Saldo"]],
      body: data.clientesEntrega.map((c: any) => [
        c.nombre,
        String(c.entregas),
        `${formatNumber(c.litros, 0)} L`,
        formatCurrency(c.ventas),
        formatCurrency(c.recibido),
        formatCurrency(c.saldo),
      ]),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      foot: [[
        "TOTAL",
        String(data.clientesEntrega.reduce((s: number, c: any) => s + c.entregas, 0)),
        `${formatNumber(data.totalLitros, 0)} L`,
        formatCurrency(data.totalVentas),
        formatCurrency(data.totalRecibido),
        formatCurrency(data.totalPorCobrar),
      ]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === 4. GASTOS ===
  if (data.gastos.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("4. Gastos", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Tipo", "Descripción", "Monto", "Pagado por"]],
      body: data.gastos.map((g: any) => [
        formatDateTime(g.fecha),
        labelTipoGasto(g.tipo),
        g.descripcion || "—",
        formatCurrency(g.monto),
        g.pagadoPor === "chofer" ? "Chofer" : "Dueño",
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      foot: [["", "", "Total", formatCurrency(data.totalGastos), ""]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === SECCIONES EXTRAS (solo modo completo) ===
  if (tipo === "completo") {
    // Pagos sueltos del día (detalle)
    if (data.pagos.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text("5. Pagos sueltos recibidos (abonos a cuenta)", 14, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Cliente", "Método", "Monto", "Nota"]],
        body: data.pagos.map((p: any) => [formatDateTime(p.fecha), p.cliente?.nombre || "—", p.metodoPago, formatCurrency(p.monto), p.nota || "—"]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        foot: [["", "", "Total", formatCurrency(data.totalPagosSueltos), ""]],
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Clientes con saldo pendiente histórico
    if (data.clientes.length > 0) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text(`6. Clientes con saldo pendiente histórico (${data.clientes.length})`, 14, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Cliente", "Teléfono", "Zona", "Saldo"]],
        body: data.clientes.map((c: any) => [c.nombre, c.telefono || "—", c.zona || "—", formatCurrency(c.saldo)]),
        theme: "striped",
        headStyles: { fillColor: [245, 158, 11], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        foot: [["", "", "Total", formatCurrency(data.totalSaldoPendiente)]],
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Liquidación del chofer
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("7. Liquidación del chofer (informativa)", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Valor"]],
      body: [
        ["Modo de liquidación", labelModoLiquidacion(data.cfg.modoLiquidacion)],
        ["Ventas", formatCurrency(data.totalVentas)],
        ["Gastos", formatCurrency(data.totalGastos)],
        ["Utilidad bruta", formatCurrency(data.utilidadBruta)],
        ["Pago al chofer", formatCurrency(data.pagoChofer)],
        ["Gastos chofer (reembolsables)", formatCurrency(data.gastosChofer)],
        ["Líquido del chofer", formatCurrency(data.liquidoChofer)],
        ["- Efectivo ya recibido", formatCurrency(data.totalEfectivo)],
        [data.saldoChofer >= 0 ? "Dueño debe al chofer" : "Chofer debe al dueño", formatCurrency(Math.abs(data.saldoChofer))],
      ],
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
    });
  }

  const pdfBuffer = doc.output("arraybuffer");
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resumen-${period}.pdf"`,
    },
  });
}

function generarExcel(tipo: string, period: string, data: any) {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();

  function setColWidths(ws: any, widths: number[]) {
    ws["!cols"] = widths.map(w => ({ wch: w }));
  }

  // === HOJA 1: VENTAS ===
  const ventasRows = [
    ["Resumen Diario - Aljibe App"],
    [`Periodo: ${period}`],
    [`Generado: ${formatNowCL()} (hora Chile)`],
    [`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`],
    [],
    ["VENTAS"],
    ["Concepto", "Valor"],
    ["Total ventas", data.totalVentas],
    ["Litros entregados", data.totalLitros],
    ["Cantidad de entregas", data.entregas.length],
    ["Vueltas", data.vueltas.length],
    ["Por cobrar del día (saldo)", data.totalPorCobrar],
    [],
    ["EFECTIVO / PAGOS RECIBIDOS"],
    ["Concepto", "Valor"],
    ["Efectivo (entregas + pagos sueltos)", data.efectivoTotal],
    ["  · Efectivo en entregas", data.totalEfectivo],
    ["  · Efectivo en pagos sueltos", data.pagosSueltosEfectivo],
    ["Transferencia (entregas + pagos sueltos)", data.transferenciaTotal],
    ["  · Transferencia en entregas", data.totalTransferencia],
    ["  · Transferencia en pagos sueltos", data.pagosSueltosTransferencia],
    ["TOTAL cobrado", data.totalCobrado],
    [],
    ["GASTOS"],
    ["Concepto", "Valor"],
    ["Total gastos", data.totalGastos],
    ["  · Gastos del chofer", data.gastosChofer],
    ["  · Gastos del dueño", data.gastosDueno],
  ];
  const wsVentas = XLSX.utils.aoa_to_sheet(ventasRows);
  setColWidths(wsVentas, [44, 18]);
  XLSX.utils.book_append_sheet(wb, wsVentas, "Resumen");

  // === HOJA 2: CLIENTES CON CANTIDAD ENTREGADA ===
  const clientesRows = [
    ["Cliente", "Entregas", "Litros", "Total vendido", "Recibido", "Saldo"],
    ...data.clientesEntrega.map((c: any) => [c.nombre, c.entregas, c.litros, c.ventas, c.recibido, c.saldo]),
    [],
    ["TOTAL", data.clientesEntrega.reduce((s: number, c: any) => s + c.entregas, 0), data.totalLitros, data.totalVentas, data.totalRecibido, data.totalPorCobrar],
  ];
  const wsClientes = XLSX.utils.aoa_to_sheet(clientesRows);
  setColWidths(wsClientes, [24, 10, 10, 14, 14, 14]);
  XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes del día");

  // === HOJA 3: GASTOS ===
  if (data.gastos.length > 0) {
    const gastosRows = [
      ["Fecha", "Tipo", "Descripción", "Monto", "Pagado por"],
      ...data.gastos.map((g: any) => [formatDateTime(g.fecha), labelTipoGasto(g.tipo), g.descripcion || "", g.monto, g.pagadoPor === "chofer" ? "Chofer" : "Dueño"]),
      [],
      ["Total gastos chofer", "", "", data.gastosChofer, ""],
      ["Total gastos dueño", "", "", data.gastosDueno, ""],
      ["TOTAL GASTOS", "", "", data.totalGastos, ""],
    ];
    const wsGastos = XLSX.utils.aoa_to_sheet(gastosRows);
    setColWidths(wsGastos, [18, 16, 30, 12, 14]);
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
  }

  // === HOJAS EXTRA (solo modo completo) ===
  if (tipo === "completo") {
    // Pagos sueltos
    if (data.pagos.length > 0) {
      const pagosRows = [
        ["Fecha", "Cliente", "Método", "Monto", "Nota"],
        ...data.pagos.map((p: any) => [formatDateTime(p.fecha), p.cliente?.nombre || "-", p.metodoPago, p.monto, p.nota || ""]),
        [],
        ["Total pagos sueltos", "", "", data.totalPagosSueltos, ""],
      ];
      const wsPagos = XLSX.utils.aoa_to_sheet(pagosRows);
      setColWidths(wsPagos, [18, 22, 14, 12, 30]);
      XLSX.utils.book_append_sheet(wb, wsPagos, "Pagos sueltos");
    }

    // Clientes con saldo pendiente histórico
    if (data.clientes.length > 0) {
      const pendientesRows = [
        ["Cliente", "Teléfono", "Zona", "Dirección", "Saldo pendiente"],
        ...data.clientes.map((c: any) => [c.nombre, c.telefono || "", c.zona || "", c.direccion || "", c.saldo]),
        [],
        ["TOTAL saldo pendiente", "", "", "", data.totalSaldoPendiente],
      ];
      const wsPendientes = XLSX.utils.aoa_to_sheet(pendientesRows);
      setColWidths(wsPendientes, [22, 14, 16, 24, 16]);
      XLSX.utils.book_append_sheet(wb, wsPendientes, "Pagos pendientes");
    }

    // Vueltas
    if (data.vueltas.length > 0) {
      const vueltasRows = [
        ["#", "Inicio", "Cierre", "Chofer", "Camión", "Entregas", "Litros", "Ventas", "Efectivo", "Transferencia"],
        ...data.vueltas.map((v: any) => {
          const litros = v.entregas.reduce((s: number, e: any) => s + e.litros, 0);
          const ventas = v.entregas.reduce((s: number, e: any) => s + e.total, 0);
          const efectivo = v.entregas.reduce((s: number, e: any) => s + e.montoEfectivo, 0);
          const transf = v.entregas.reduce((s: number, e: any) => s + e.montoTransferencia, 0);
          return [v.numero, formatDateTime(v.iniciadaEn), v.cerradaEn ? formatDateTime(v.cerradaEn) : "En curso", v.chofer?.nombre || "-", v.camion?.nombre || "-", v.entregas.length, litros, ventas, efectivo, transf];
        }),
      ];
      const wsVueltas = XLSX.utils.aoa_to_sheet(vueltasRows);
      setColWidths(wsVueltas, [6, 18, 18, 20, 14, 10, 10, 14, 14, 14]);
      XLSX.utils.book_append_sheet(wb, wsVueltas, "Vueltas");
    }
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resumen-${period}.xlsx"`,
    },
  });
}
