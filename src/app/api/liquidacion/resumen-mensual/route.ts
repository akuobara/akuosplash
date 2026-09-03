// Resumen mensual de liquidación en PDF o Excel
// GET /api/liquidacion/resumen-mensual?year=2026&month=8&formato=pdf|excel
import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { formatCurrency, formatNumber, formatDateTime, formatNowCL, labelTipoGasto, labelMetodoPago, labelEstadoPago, labelModoLiquidacion, esVueltaCompletada } from "@/lib/helpers";

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year") || now.getFullYear());
  const month = Number(searchParams.get("month") || now.getMonth()); // 0-indexed
  const formato = searchParams.get("formato") || "pdf";

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  const [entregas, gastos, vueltas, config] = await Promise.all([
    db.entrega.findMany({
      where: { duenoId, fecha: { gte: start, lt: end } },
      orderBy: { fecha: "desc" },
      include: { vuelta: { select: { numero: true } } },
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
        entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true } },
      },
      orderBy: { iniciadaEn: "desc" },
    }),
    db.configuracion.findUnique({ where: { duenoId } }),
  ]);

  const cfg = config ?? {
    nombreDueno: "Dueño",
    nombreChofer: "Chofer",
    modoLiquidacion: "porcentaje",
    porcentajeComisionChofer: 50,
    porcentajeComisionDueno: 50,
    montoPorVueltaUnicoCliente: 20000,
    montoPorVueltaMultiple: 25000,
    capacidadCamion: 17000,
    tipoTributo: "ninguno",
    porcentajeImpuesto: 0,
    aplicaImpuestoSobre: "pago_chofer",
  };

  // Cálculos
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const gastosDueno = gastos.filter(g => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);
  const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
  const utilidadBruta = totalVentas - totalGastos;

  let pagoChofer = 0;
  let vueltasValidas: typeof vueltas = [];
  if (cfg.modoLiquidacion === "vuelta") {
    vueltasValidas = vueltas.filter(v => {
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const cap = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
      return esVueltaCompletada(litros, cap, v.entregas.length, cfg.umbralCompletacionVuelta, (v as any).validadaManualmente);
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

  const vueltasDetalle = vueltas.map(v => {
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
    const efectivo = v.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const transf = v.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
    const cap = v.camion?.capacidad ?? cfg.capacidadCamion ?? 0;
    const completada = esVueltaCompletada(litros, cap, v.entregas.length, cfg.umbralCompletacionVuelta, (v as any).validadaManualmente);
    const pagoVuelta = cfg.modoLiquidacion === "vuelta" && completada
      ? (v.entregas.length > 1 ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente)
      : 0;
    return {
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

  const data = {
    monthLabel,
    cfg,
    entregas, gastos, vueltas: vueltasDetalle,
    totalVentas, totalEfectivo, totalTransferencia, totalLitros,
    totalGastos, gastosChofer, gastosDueno, descuentosChofer, utilidadBruta,
    pagoChofer, impuesto, liquidoChofer, saldoChofer,
    vueltasCompletadas: vueltasValidas.length,
    vueltasTotal: vueltas.length,
  };

  if (formato === "excel") return generarExcel(data);
  return generarPDF(data);
}

function generarPDF(data: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(16);
  doc.text("Resumen mensual de liquidación", 14, 18);
  doc.setFontSize(10);
  doc.text(`Periodo: ${data.monthLabel}`, 14, 25);
  doc.text(`Generado: ${formatNowCL()} (hora Chile)`, 14, 30);
  doc.text(`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`, 14, 35);

  let y = 42;

  // Resumen
  doc.setFontSize(13);
  doc.text("Resumen", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Total ventas", formatCurrency(data.totalVentas)],
      ["Efectivo recibido", formatCurrency(data.totalEfectivo)],
      ["Transferencia", formatCurrency(data.totalTransferencia)],
      ["Litros entregados", `${formatNumber(data.totalLitros, 0)} L`],
      ["Entregas", String(data.entregas.length)],
      ["Vueltas", String(data.vueltasTotal)],
      ["Vueltas completadas", String(data.vueltasCompletadas)],
      ["Gastos totales", formatCurrency(data.totalGastos)],
      ["  · Gastos chofer", formatCurrency(data.gastosChofer)],
      ["  · Gastos dueño", formatCurrency(data.gastosDueno)],
      ["Utilidad bruta", formatCurrency(data.utilidadBruta)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Liquidación chofer
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.text("Liquidación chofer", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Modo", labelModoLiquidacion(data.cfg.modoLiquidacion)],
      ["Ventas", formatCurrency(data.totalVentas)],
      ["Gastos", formatCurrency(data.totalGastos)],
      ["Utilidad bruta", formatCurrency(data.utilidadBruta)],
      ["Pago chofer", formatCurrency(data.pagoChofer)],
      ["Gastos chofer (reembolsables)", formatCurrency(data.gastosChofer)],
      ["Descuentos chofer", formatCurrency(data.descuentosChofer)],
      [`Impuesto (${data.cfg.porcentajeImpuesto}%)`, formatCurrency(data.impuesto)],
      ["Líquido chofer", formatCurrency(data.liquidoChofer)],
      ["- Efectivo recibido", formatCurrency(data.totalEfectivo)],
      [data.saldoChofer >= 0 ? "Dueño debe al chofer" : "Chofer debe al dueño", formatCurrency(Math.abs(data.saldoChofer))],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Vueltas
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.text("Vueltas del mes", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["#", "Inicio", "Cierre", "Camión", "Chofer", "Entregas", "Litros", "Ventas", "Efectivo", "Transf.", "Compl.", "Pago"]],
    body: data.vueltas.map((v: any) => [
      String(v.numero),
      formatDateTime(v.iniciadaEn),
      v.cerradaEn ? formatDateTime(v.cerradaEn) : "—",
      v.camion,
      v.chofer,
      String(v.cantidadEntregas),
      `${formatNumber(v.litros, 0)} L`,
      formatCurrency(v.ventas),
      formatCurrency(v.efectivo),
      formatCurrency(v.transferencia),
      v.completada ? "Sí" : "No",
      formatCurrency(v.pagoVuelta),
    ]),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
    bodyStyles: { fontSize: 7 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Gastos detallados
  if (data.gastos.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("Gastos del mes", 14, y);
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
  }

  const buffer = doc.output("arraybuffer");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="liquidacion-${data.monthLabel.replace(/ /g, "-")}.pdf"`,
    },
  });
}

function generarExcel(data: any) {
  const wb = XLSX.utils.book_new();
  const setColWidths = (ws: any, widths: number[]) => { ws["!cols"] = widths.map(w => ({ wch: w })); };

  // Hoja 1: Resumen + Liquidación
  const rows: any[] = [
    ["Resumen mensual de liquidación"],
    [`Periodo: ${data.monthLabel}`],
    [`Generado: ${formatNowCL()} (hora Chile)`],
    [`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`],
    [],
    ["RESUMEN"],
    ["Concepto", "Valor"],
    ["Total ventas", data.totalVentas],
    ["Efectivo", data.totalEfectivo],
    ["Transferencia", data.totalTransferencia],
    ["Litros", data.totalLitros],
    ["Entregas", data.entregas.length],
    ["Vueltas", data.vueltasTotal],
    ["Vueltas completadas", data.vueltasCompletadas],
    ["Gastos totales", data.totalGastos],
    ["  · Gastos chofer", data.gastosChofer],
    ["  · Gastos dueño", data.gastosDueno],
    ["Utilidad bruta", data.utilidadBruta],
    [],
    ["LIQUIDACIÓN CHOFER"],
    ["Modo", labelModoLiquidacion(data.cfg.modoLiquidacion)],
    ["Pago chofer", data.pagoChofer],
    ["Gastos chofer (reembolsables)", data.gastosChofer],
    ["Descuentos chofer", data.descuentosChofer],
    [`Impuesto (${data.cfg.porcentajeImpuesto}%)`, data.impuesto],
    ["Líquido chofer", data.liquidoChofer],
    ["- Efectivo recibido", data.totalEfectivo],
    [data.saldoChofer >= 0 ? "Dueño debe al chofer" : "Chofer debe al dueño", Math.abs(data.saldoChofer)],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws1, [40, 18]);
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

  // Hoja 2: Vueltas
  const vueltasRows: any[] = [
    ["#", "Inicio", "Cierre", "Camión", "Chofer", "Entregas", "Litros", "Ventas", "Efectivo", "Transferencia", "Completada", "Pago"],
    ...data.vueltas.map((v: any) => [
      v.numero, formatDateTime(v.iniciadaEn), v.cerradaEn ? formatDateTime(v.cerradaEn) : "—",
      v.camion, v.chofer, v.cantidadEntregas, v.litros, v.ventas, v.efectivo, v.transferencia,
      v.completada ? "Sí" : "No", v.pagoVuelta,
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(vueltasRows);
  setColWidths(ws2, [6, 18, 18, 14, 18, 10, 10, 12, 12, 14, 12, 12]);
  XLSX.utils.book_append_sheet(wb, ws2, "Vueltas");

  // Hoja 3: Gastos
  if (data.gastos.length > 0) {
    const gastosRows: any[] = [
      ["Fecha", "Tipo", "Descripción", "Monto", "Pagado por"],
      ...data.gastos.map((g: any) => [formatDateTime(g.fecha), labelTipoGasto(g.tipo), g.descripcion || "", g.monto, g.pagadoPor === "chofer" ? "Chofer" : "Dueño"]),
      [],
      ["Total", "", "", data.totalGastos, ""],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(gastosRows);
    setColWidths(ws3, [18, 14, 30, 12, 14]);
    XLSX.utils.book_append_sheet(wb, ws3, "Gastos");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidacion-${data.monthLabel.replace(/ /g, "-")}.xlsx"`,
    },
  });
}
