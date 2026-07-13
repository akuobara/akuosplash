// Genera un reporte en PDF o Excel
// GET /api/reportes/descargar?tipo=simple|completo&formato=pdf|excel&period=...
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, formatCurrency, formatNumber, formatDate, formatDateTime, labelTipoGasto, labelMetodoPago, labelEstadoPago, labelModoLiquidacion, esVueltaCompletada } from "@/lib/helpers";

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

  const [entregas, gastos, vueltas, config] = await Promise.all([
    db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" }, include: { vuelta: { select: { numero: true } } } }),
    db.gasto.findMany({ where: gastoWhere, orderBy: { fecha: "desc" } }),
    db.vuelta.findMany({ where: vueltaWhere, include: { camion: { select: { nombre: true, capacidad: true } }, chofer: { select: { nombre: true } }, entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true, metodoPago: true, estadoPago: true, fecha: true, descuento: true, detalleEstanquesJson: true } } }, orderBy: { iniciadaEn: "desc" } }),
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

  if (formato === "excel") {
    return generarExcel(tipo, periodLabel, { entregas, gastos, vueltas, cfg, totalVentas, totalEfectivo, totalTransferencia, totalRecibido, totalPorCobrar, totalLitros, totalGastos, gastosChofer, gastosDueno, descuentosChofer, utilidadBruta, pagoChofer, impuesto, liquidoChofer, saldoChofer });
  }
  return generarPDF(tipo, periodLabel, { entregas, gastos, vueltas, cfg, totalVentas, totalEfectivo, totalTransferencia, totalRecibido, totalPorCobrar, totalLitros, totalGastos, gastosChofer, gastosDueno, descuentosChofer, utilidadBruta, pagoChofer, impuesto, liquidoChofer, saldoChofer });
}

function generarPDF(tipo: string, period: string, data: any) {
  // Lado del servidor: usar jsPDF
  const { jsPDF } = require("jspdf");
  const autoTable = require("jspdf-autotable");
  const doc = new jsPDF();

  // Encabezado
  doc.setFontSize(16);
  doc.text("Reporte de Agua - Aljibe App", 14, 20);
  doc.setFontSize(10);
  doc.text(`Periodo: ${period}`, 14, 27);
  doc.text(`Generado: ${new Date().toLocaleString("es-CL")}`, 14, 32);
  doc.text(`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`, 14, 37);

  let y = 45;

  // Resumen
  doc.setFontSize(12);
  doc.text("Resumen", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Total ventas", formatCurrency(data.totalVentas)],
      ["Efectivo recibido", formatCurrency(data.totalEfectivo)],
      ["Transferencia recibida", formatCurrency(data.totalTransferencia)],
      ["Total recibido", formatCurrency(data.totalRecibido)],
      ["Por cobrar", formatCurrency(data.totalPorCobrar)],
      ["Litros entregados", `${formatNumber(data.totalLitros, 0)} L`],
      ["Entregas", String(data.entregas.length)],
      ["Vueltas", String(data.vueltas.length)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  if (tipo === "completo") {
    // Gastos
    doc.setFontSize(12);
    doc.text("Gastos", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Tipo", "Descripción", "Monto", "Pagado por"]],
      body: data.gastos.map((g: any) => [formatDate(g.fecha), labelTipoGasto(g.tipo), g.descripcion || "-", formatCurrency(g.monto), g.pagadoPor === "chofer" ? "Chofer" : "Dueño"]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38] },
      foot: [["", "", "Total gastos", formatCurrency(data.totalGastos), ""]],
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Liquidación
    doc.setFontSize(12);
    doc.text("Liquidación", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Valor"]],
      body: [
        ["Modo", labelModoLiquidacion(data.cfg.modoLiquidacion)],
        ["Utilidad bruta", formatCurrency(data.utilidadBruta)],
        ["Pago al chofer", formatCurrency(data.pagoChofer)],
        ["Gastos del chofer (reembolsables)", formatCurrency(data.gastosChofer)],
        ["Descuentos del chofer", formatCurrency(data.descuentosChofer)],
        [`Impuesto (${data.cfg.porcentajeImpuesto}%)`, formatCurrency(data.impuesto)],
        ["Líquido chofer (antes de efectivo)", formatCurrency(data.liquidoChofer)],
        ["− Efectivo recibido en ruta", formatCurrency(data.totalEfectivo)],
        [data.saldoChofer >= 0 ? "El dueño le debe al chofer" : "El chofer le debe al dueño", formatCurrency(Math.abs(data.saldoChofer))],
      ],
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129] },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Vueltas
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(12);
  doc.text("Vueltas", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["#", "Inicio", "Cierre", "Entregas", "Litros", "Ventas", "Efectivo", "Transf."]],
    body: data.vueltas.map((v: any) => {
      const litros = v.entregas.reduce((s: number, e: any) => s + e.litros, 0);
      const ventas = v.entregas.reduce((s: number, e: any) => s + e.total, 0);
      const efectivo = v.entregas.reduce((s: number, e: any) => s + e.montoEfectivo, 0);
      const transf = v.entregas.reduce((s: number, e: any) => s + e.montoTransferencia, 0);
      return [String(v.numero), formatDate(v.iniciadaEn), v.cerradaEn ? formatDate(v.cerradaEn) : "En curso", String(v.entregas.length), `${formatNumber(litros, 0)} L`, formatCurrency(ventas), formatCurrency(efectivo), formatCurrency(transf)];
    }),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Entregas
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(12);
  doc.text("Entregas", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Fecha", "Cliente", "Litros", "Método", "Total", "Efectivo", "Transf.", "Saldo", "Estado"]],
    body: data.entregas.map((e: any) => [
      formatDate(e.fecha),
      e.clienteNombre,
      `${formatNumber(e.litros, 0)} L`,
      labelMetodoPago(e.metodoPago),
      formatCurrency(e.total),
      formatCurrency(e.montoEfectivo),
      formatCurrency(e.montoTransferencia),
      formatCurrency(Math.max(0, e.total - e.montoRecibido)),
      labelEstadoPago(e.estadoPago),
    ]),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235] },
  });

  const pdfBuffer = doc.output("arraybuffer");
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="reporte-${period}-${tipo}.pdf"`,
    },
  });
}

function generarExcel(tipo: string, period: string, data: any) {
  const XLSX = require("xlsx");

  const wb = XLSX.utils.book_new();

  // Hoja: Resumen
  const resumenRows = [
    ["Reporte de Agua - Aljibe App"],
    [`Periodo: ${period}`],
    [`Generado: ${new Date().toLocaleString("es-CL")}`],
    [`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`],
    [],
    ["Concepto", "Valor"],
    ["Total ventas", data.totalVentas],
    ["Efectivo recibido", data.totalEfectivo],
    ["Transferencia recibida", data.totalTransferencia],
    ["Total recibido", data.totalRecibido],
    ["Por cobrar", data.totalPorCobrar],
    ["Litros entregados", data.totalLitros],
    ["Entregas", data.entregas.length],
    ["Vueltas", data.vueltas.length],
  ];

  if (tipo === "completo") {
    resumenRows.push([], ["LIQUIDACIÓN"]);
    resumenRows.push(["Modo", labelModoLiquidacion(data.cfg.modoLiquidacion)]);
    resumenRows.push(["Utilidad bruta", data.utilidadBruta]);
    resumenRows.push(["Pago al chofer", data.pagoChofer]);
    resumenRows.push(["Gastos chofer (reembolsables)", data.gastosChofer]);
    resumenRows.push(["Descuentos chofer", data.descuentosChofer]);
    resumenRows.push([`Impuesto (${data.cfg.porcentajeImpuesto}%)`, data.impuesto]);
    resumenRows.push(["Líquido chofer (antes de efectivo)", data.liquidoChofer]);
    resumenRows.push(["Efectivo recibido en ruta", data.totalEfectivo]);
    resumenRows.push([data.saldoChofer >= 0 ? "Dueño debe al chofer" : "Chofer debe al dueño", Math.abs(data.saldoChofer)]);
  }

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Hoja: Entregas
  const entregasRows = [
    ["Fecha", "Cliente", "Litros", "Método", "Total", "Efectivo", "Transferencia", "Recibido", "Saldo", "Estado", "Descuento", "Vuelta #"],
    ...data.entregas.map((e: any) => [
      formatDate(e.fecha), e.clienteNombre, e.litros, labelMetodoPago(e.metodoPago), e.total, e.montoEfectivo, e.montoTransferencia, e.montoRecibido, Math.max(0, e.total - e.montoRecibido), labelEstadoPago(e.estadoPago), e.descuento || 0, e.vuelta?.numero || "-",
    ]),
  ];
  const wsEntregas = XLSX.utils.aoa_to_sheet(entregasRows);
  XLSX.utils.book_append_sheet(wb, wsEntregas, "Entregas");

  // Hoja: Vueltas
  const vueltasRows = [
    ["#", "Inicio", "Cierre", "Entregas", "Litros", "Ventas", "Efectivo", "Transferencia", "Camión", "Chofer"],
    ...data.vueltas.map((v: any) => {
      const litros = v.entregas.reduce((s: number, e: any) => s + e.litros, 0);
      const ventas = v.entregas.reduce((s: number, e: any) => s + e.total, 0);
      const efectivo = v.entregas.reduce((s: number, e: any) => s + e.montoEfectivo, 0);
      const transf = v.entregas.reduce((s: number, e: any) => s + e.montoTransferencia, 0);
      return [v.numero, formatDate(v.iniciadaEn), v.cerradaEn ? formatDate(v.cerradaEn) : "En curso", v.entregas.length, litros, ventas, efectivo, transf, v.camion?.nombre || "-", v.chofer?.nombre || "-"];
    }),
  ];
  const wsVueltas = XLSX.utils.aoa_to_sheet(vueltasRows);
  XLSX.utils.book_append_sheet(wb, wsVueltas, "Vueltas");

  // Hoja: Gastos (solo completo)
  if (tipo === "completo" && data.gastos.length > 0) {
    const gastosRows = [
      ["Fecha", "Tipo", "Descripción", "Monto", "Pagado por"],
      ...data.gastos.map((g: any) => [formatDate(g.fecha), labelTipoGasto(g.tipo), g.descripcion || "", g.monto, g.pagadoPor === "chofer" ? "Chofer" : "Dueño"]),
      [],
      ["Total gastos", "", "", data.totalGastos, ""],
      ["Gastos chofer", "", "", data.gastosChofer, ""],
      ["Gastos dueño", "", "", data.gastosDueno, ""],
    ];
    const wsGastos = XLSX.utils.aoa_to_sheet(gastosRows);
    XLSX.utils.book_append_sheet(wb, wsGastos, "Gastos");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reporte-${period}-${tipo}.xlsx"`,
    },
  });
}
