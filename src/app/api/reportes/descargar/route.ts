// Genera un reporte en PDF o Excel
// GET /api/reportes/descargar?tipo=simple|completo&formato=pdf|excel&period=...
//
// Modo simple: Resumen + Vueltas + Entregas + Pagos sueltos + Clientes con saldo + Gastos
// Modo completo: Agrega liquidación del chofer al final (para dueños que pagan al día)
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

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivo + totalTransferencia;
  const totalPorCobrar = totalVentas - totalRecibido;
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter(g => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);
  const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
  const utilidadBruta = totalVentas - totalGastos;

  const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
  const pagosSueltosEfectivo = pagos.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0);
  const pagosSueltosTransferencia = pagos.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);

  // Pagos pendientes por cliente (saldo histórico)
  const clienteIds = new Set<string>(clientes.map(c => c.id));
  const saldosPorCliente = new Map<string, { nombre: string; telefono: string | null; zona: string | null; direccion: string | null; totalVentas: number; totalRecibido: number; pagosSueltos: number; saldo: number; entregasCount: number }>();

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
      nombre: c.nombre,
      telefono: c.telefono,
      zona: c.zona,
      direccion: c.direccion,
      totalVentas: 0,
      totalRecibido: 0,
      pagosSueltos: 0,
      saldo: 0,
      entregasCount: c._count.entregas,
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

  // Liquidación (solo modo completo)
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
    entregas, gastos, vueltas, pagos, clientes: clientesConSaldo, cfg,
    totalVentas, totalEfectivo, totalTransferencia, totalRecibido, totalPorCobrar,
    totalLitros, totalGastos, gastosChofer, gastosDueno, descuentosChofer, utilidadBruta,
    pagoChofer, impuesto, liquidoChofer, saldoChofer,
    totalPagosSueltos, pagosSueltosEfectivo, pagosSueltosTransferencia,
    totalSaldoPendiente,
    clientesActivosCount: clientes.length,
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
  doc.text("Resumen Diario - Aljibe App", 14, 18);
  doc.setFontSize(10);
  doc.text(`Periodo: ${period}`, 14, 25);
  doc.text(`Generado: ${formatNowCL()} (hora Chile)`, 14, 30);
  doc.text(`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`, 14, 35);

  let y = 42;

  // 1. Resumen
  doc.setFontSize(13);
  doc.text("1. Resumen", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Ventas totales", formatCurrency(data.totalVentas)],
      ["  - Efectivo recibido", formatCurrency(data.totalEfectivo)],
      ["  - Transferencia recibida", formatCurrency(data.totalTransferencia)],
      ["  - Por cobrar del día", formatCurrency(data.totalPorCobrar)],
      ["Pagos sueltos recibidos (abonos)", formatCurrency(data.totalPagosSueltos)],
      ["Litros entregados", `${formatNumber(data.totalLitros, 0)} L`],
      ["Cantidad de entregas", String(data.entregas.length)],
      ["Cantidad de vueltas", String(data.vueltas.length)],
      ["Clientes con saldo pendiente", String(data.clientes.length)],
      ["Saldo total pendiente (histórico)", formatCurrency(data.totalSaldoPendiente)],
      ["Gastos totales", formatCurrency(data.totalGastos)],
      ["  - Gastos del chofer", formatCurrency(data.gastosChofer)],
      ["  - Gastos del dueño", formatCurrency(data.gastosDueno)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // 2. Vueltas
  if (data.vueltas.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("2. Vueltas del día", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["#", "Inicio", "Cierre", "Chofer", "Camión", "Entregas", "Litros", "Ventas"]],
      body: data.vueltas.map((v: any) => {
        const litros = v.entregas.reduce((s: number, e: any) => s + e.litros, 0);
        const ventas = v.entregas.reduce((s: number, e: any) => s + e.total, 0);
        return [
          String(v.numero),
          formatDateTime(v.iniciadaEn),
          v.cerradaEn ? formatDateTime(v.cerradaEn) : "En curso",
          v.chofer?.nombre || "—",
          v.camion?.nombre || "—",
          String(v.entregas.length),
          `${formatNumber(litros, 0)} L`,
          formatCurrency(ventas),
        ];
      }),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // 3. Entregas
  if (data.entregas.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("3. Entregas del día", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Cliente", "Litros", "Método", "Total", "Recibido", "Saldo", "Estado"]],
      body: data.entregas.map((e: any) => [
        formatDateTime(e.fecha),
        e.clienteNombre,
        `${formatNumber(e.litros, 0)} L`,
        labelMetodoPago(e.metodoPago),
        formatCurrency(e.total),
        formatCurrency(e.montoRecibido),
        formatCurrency(Math.max(0, e.total - e.montoRecibido)),
        labelEstadoPago(e.estadoPago),
      ]),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // 4. Pagos sueltos recibidos (abonos a cuenta)
  if (data.pagos.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("4. Pagos sueltos recibidos", 14, y);
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

  // 5. Clientes con saldo pendiente
  if (data.clientes.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text(`5. Clientes con saldo pendiente (${data.clientes.length})`, 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Cliente", "Teléfono", "Zona", "Dirección", "Saldo"]],
      body: data.clientes.map((c: any) => [c.nombre, c.telefono || "—", c.zona || "—", c.direccion || "—", formatCurrency(c.saldo)]),
      theme: "striped",
      headStyles: { fillColor: [245, 158, 11], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      foot: [["", "", "", "Total", formatCurrency(data.totalSaldoPendiente)]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // 6. Gastos
  if (data.gastos.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("6. Gastos del día", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Tipo", "Descripción", "Monto", "Pagado por"]],
      body: data.gastos.map((g: any) => [formatDateTime(g.fecha), labelTipoGasto(g.tipo), g.descripcion || "—", formatCurrency(g.monto), g.pagadoPor === "chofer" ? "Chofer" : "Dueño"]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      foot: [["", "", "Total", formatCurrency(data.totalGastos), ""]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // 7. Liquidación del chofer (solo en modo completo)
  if (tipo === "completo") {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("7. Liquidación del chofer", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Valor"]],
      body: [
        ["Modo de liquidación", labelModoLiquidacion(data.cfg.modoLiquidacion)],
        ["Ventas totales", formatCurrency(data.totalVentas)],
        ["Gastos totales", formatCurrency(data.totalGastos)],
        ["Utilidad bruta (ventas - gastos)", formatCurrency(data.utilidadBruta)],
        ["Pago al chofer según modo", formatCurrency(data.pagoChofer)],
        ["Gastos chofer (reembolsables)", formatCurrency(data.gastosChofer)],
        ["Descuentos del chofer", formatCurrency(data.descuentosChofer)],
        [`Impuesto (${data.cfg.porcentajeImpuesto}%)`, formatCurrency(data.impuesto)],
        ["Líquido del chofer", formatCurrency(data.liquidoChofer)],
        ["- Efectivo ya recibido en ruta", formatCurrency(data.totalEfectivo)],
        [data.saldoChofer >= 0 ? "El dueño le debe al chofer" : "El chofer le debe al dueño", formatCurrency(Math.abs(data.saldoChofer))],
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

  // Helper: setear ancho de columnas
  function setColWidths(ws: any, widths: number[]) {
    ws["!cols"] = widths.map(w => ({ wch: w }));
  }

  // Hoja: Resumen
  const resumenRows = [
    ["Resumen Diario - Aljibe App"],
    [`Periodo: ${period}`],
    [`Generado: ${formatNowCL()} (hora Chile)`],
    [`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`],
    [],
    ["Concepto", "Valor"],
    ["Ventas totales", data.totalVentas],
    ["  - Efectivo recibido", data.totalEfectivo],
    ["  - Transferencia recibida", data.totalTransferencia],
    ["  - Por cobrar del día", data.totalPorCobrar],
    ["Pagos sueltos recibidos (abonos)", data.totalPagosSueltos],
    ["Litros entregados", data.totalLitros],
    ["Cantidad de entregas", data.entregas.length],
    ["Cantidad de vueltas", data.vueltas.length],
    ["Clientes con saldo pendiente", data.clientes.length],
    ["Saldo total pendiente (histórico)", data.totalSaldoPendiente],
    ["Gastos totales", data.totalGastos],
    ["  - Gastos del chofer", data.gastosChofer],
    ["  - Gastos del dueño", data.gastosDueno],
  ];

  if (tipo === "completo") {
    resumenRows.push([], ["LIQUIDACIÓN DEL CHOFER (solo informativa)"]);
    resumenRows.push(["Modo de liquidación", labelModoLiquidacion(data.cfg.modoLiquidacion)]);
    resumenRows.push(["Pago al chofer según modo", data.pagoChofer]);
    resumenRows.push(["Gastos chofer (reembolsables)", data.gastosChofer]);
    resumenRows.push(["Descuentos del chofer", data.descuentosChofer]);
    resumenRows.push([`Impuesto (${data.cfg.porcentajeImpuesto}%)`, data.impuesto]);
    resumenRows.push(["Líquido del chofer", data.liquidoChofer]);
    resumenRows.push(["- Efectivo ya recibido en ruta", data.totalEfectivo]);
    resumenRows.push([data.saldoChofer >= 0 ? "El dueño le debe al chofer" : "El chofer le debe al dueño", Math.abs(data.saldoChofer)]);
  }

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  setColWidths(wsResumen, [42, 18]);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Hoja: Vueltas
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

  // Hoja: Entregas
  const entregasRows = [
    ["Fecha", "Cliente", "Teléfono", "Zona", "Litros", "Método", "Total", "Efectivo", "Transferencia", "Recibido", "Saldo", "Estado", "Vuelta #"],
    ...data.entregas.map((e: any) => [
      formatDateTime(e.fecha), e.clienteNombre, e.cliente?.telefono || "-", e.cliente?.zona || "-",
      e.litros, labelMetodoPago(e.metodoPago), e.total, e.montoEfectivo, e.montoTransferencia,
      e.montoRecibido, Math.max(0, e.total - e.montoRecibido), labelEstadoPago(e.estadoPago),
      e.vuelta?.numero || "-",
    ]),
  ];
  const wsEntregas = XLSX.utils.aoa_to_sheet(entregasRows);
  setColWidths(wsEntregas, [18, 22, 14, 16, 10, 14, 12, 12, 14, 12, 12, 12, 8]);
  XLSX.utils.book_append_sheet(wb, wsEntregas, "Entregas");

  // Hoja: Pagos sueltos
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

  // Hoja: Clientes con saldo pendiente
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

  // Hoja: Gastos
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

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resumen-${period}.xlsx"`,
    },
  });
}
