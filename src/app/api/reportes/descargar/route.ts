// Resumen diario — 4 secciones:
//   1. Ventas
//   2. Pagos (efectivo recibido, transferencia a administración, pendientes)
//   3. Clientes con cantidad entregada
//   4. Gastos (tipo + monto, agrupado)
// GET /api/reportes/descargar?formato=pdf|excel&period=...
import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, formatCurrency, formatNumber, formatDateTime, formatNowCL, labelTipoGasto } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const formato = searchParams.get("formato") || "pdf";
  const period = searchParams.get("period") || "hoy";
  const { start, end } = getRange(period);

  const rangeFilter = { AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}] };
  const entregaWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const gastoWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
  const pagoWhere = { ...rangeFilter, duenoId };

  const [entregas, gastos, pagos, config] = await Promise.all([
    db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" } }),
    db.gasto.findMany({ where: gastoWhere, orderBy: { fecha: "desc" } }),
    db.pago.findMany({ where: pagoWhere, orderBy: { fecha: "desc" }, include: { cliente: { select: { nombre: true } } } }),
    db.configuracion.findUnique({ where: { duenoId } }),
  ]);

  const cfg = config ?? { nombreDueno: "Dueño" };

  // === CÁLCULOS ===
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const totalRecibido = totalEfectivo + totalTransferencia;
  const totalPorCobrar = totalVentas - totalRecibido;
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
  const pagosSueltosEfectivo = pagos.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0);
  const pagosSueltosTransferencia = pagos.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);

  // === EFECTIVO + PAGOS RECIBIDOS (combinado) ===
  const efectivoTotal = totalEfectivo + pagosSueltosEfectivo;
  const transferenciaTotal = totalTransferencia + pagosSueltosTransferencia;
  const totalCobrado = efectivoTotal + transferenciaTotal;

  // === CLIENTES CON CANTIDAD ENTREGADA (agrupado por cliente) ===
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

  // === GASTOS AGRUPADOS POR TIPO (tipo + monto) ===
  const gastosPorTipoMap = new Map<string, number>();
  for (const g of gastos) {
    const tipo = labelTipoGasto(g.tipo);
    gastosPorTipoMap.set(tipo, (gastosPorTipoMap.get(tipo) || 0) + g.monto);
  }
  const gastosPorTipo = Array.from(gastosPorTipoMap.entries())
    .map(([tipo, monto]) => ({ tipo, monto }))
    .sort((a, b) => b.monto - a.monto);

  // Generar label con fecha real del período
  let periodLabel: string;
  if (period.startsWith("custom:")) {
    periodLabel = `${period.split(":")[1]} a ${period.split(":")[2]}`;
  } else if (start && end) {
    // Formatear la fecha del período
    const fechaInicio = new Date(start).toLocaleDateString("es-CL", { timeZone: "America/Santiago", day: "2-digit", month: "2-digit", year: "numeric" });
    periodLabel = fechaInicio;
  } else {
    periodLabel = "Todo";
  }

  const data = {
    entregas, gastos, pagos, clientesEntrega, gastosPorTipo, cfg,
    totalVentas, totalEfectivo, totalTransferencia, totalRecibido, totalPorCobrar,
    totalLitros, totalGastos,
    totalPagosSueltos, pagosSueltosEfectivo, pagosSueltosTransferencia,
    efectivoTotal, transferenciaTotal, totalCobrado,
  };

  if (formato === "excel") {
    return generarExcel(periodLabel, data);
  }
  return generarPDF(periodLabel, data);
}

function generarPDF(period: string, data: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Encabezado
  doc.setFontSize(18);
  doc.text(`Resumen — ${period}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`, 14, 25);

  let y = 32;

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
      ["Por cobrar del día", formatCurrency(data.totalPorCobrar)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 2. PAGOS ===
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text("2. Pagos", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Efectivo de entregas", formatCurrency(data.totalEfectivo)],
      ["Efectivo de pagos recibidos", formatCurrency(data.pagosSueltosEfectivo)],
      ["Total efectivo", formatCurrency(data.efectivoTotal)],
      ["Transferencia de entregas", formatCurrency(data.totalTransferencia)],
      ["Transferencia de pagos recibidos", formatCurrency(data.pagosSueltosTransferencia)],
      ["Total transferencia", formatCurrency(data.transferenciaTotal)],
      ["Pendiente", formatCurrency(data.totalPorCobrar)],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
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

  // === 4. PAGOS SUELTOS (detalle) ===
  if (data.pagos && data.pagos.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("4. Pagos recibidos", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Cliente", "Método", "Monto", "Nota"]],
      body: data.pagos.map((p: any) => [
        formatDateTime(p.fecha),
        p.cliente?.nombre || "—",
        p.metodoPago,
        formatCurrency(p.monto),
        p.nota || "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      foot: [["", "", "Total", formatCurrency(data.totalPagosSueltos), ""]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === 5. GASTOS (tipo + monto, agrupado) ===
  if (data.gastosPorTipo.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("5. Gastos", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Tipo de gasto", "Monto"]],
      body: data.gastosPorTipo.map((g: any) => [g.tipo, formatCurrency(g.monto)]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
      foot: [["Total", formatCurrency(data.totalGastos)]],
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

function generarExcel(period: string, data: any) {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();

  function setColWidths(ws: any, widths: number[]) {
    ws["!cols"] = widths.map(w => ({ wch: w }));
  }

  // === TODO EN UNA SOLA HOJA ===
  const rows: any[] = [
    [`Resumen — ${period}`],
    [`Empresa: ${data.cfg.nombreDueno ?? "N/A"}`],
    [],
    ["1. VENTAS"],
    ["Concepto", "Valor"],
    ["Total ventas", data.totalVentas],
    ["Litros entregados", data.totalLitros],
    ["Cantidad de entregas", data.entregas.length],
    ["Por cobrar del día", data.totalPorCobrar],
    [],
    ["2. PAGOS"],
    ["Concepto", "Valor"],
    ["Efectivo de entregas", data.totalEfectivo],
    ["Efectivo de pagos recibidos", data.pagosSueltosEfectivo],
    ["Total efectivo", data.efectivoTotal],
    ["Transferencia de entregas", data.totalTransferencia],
    ["Transferencia de pagos recibidos", data.pagosSueltosTransferencia],
    ["Total transferencia", data.transferenciaTotal],
    ["Pendiente", data.totalPorCobrar],
    [],
    ["3. CLIENTES CON CANTIDAD ENTREGADA"],
    ["Cliente", "Entregas", "Litros", "Total vendido", "Recibido", "Saldo"],
    ...data.clientesEntrega.map((c: any) => [c.nombre, c.entregas, c.litros, c.ventas, c.recibido, c.saldo]),
    ["TOTAL", data.clientesEntrega.reduce((s: number, c: any) => s + c.entregas, 0), data.totalLitros, data.totalVentas, data.totalRecibido, data.totalPorCobrar],
    [],
    ["4. PAGOS RECIBIDOS"],
    ["Fecha", "Cliente", "Método", "Monto", "Nota"],
    ...(data.pagos || []).map((p: any) => [formatDateTime(p.fecha), p.cliente?.nombre || "—", p.metodoPago, p.monto, p.nota || ""]),
    ["", "", "Total", data.totalPagosSueltos, ""],
    [],
    ["5. GASTOS"],
    ["Tipo de gasto", "Monto"],
    ...data.gastosPorTipo.map((g: any) => [g.tipo, g.monto]),
    ["Total", data.totalGastos],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Anchos de columna para que se vea todo sin cortar
  setColWidths(ws, [24, 14, 10, 14, 14, 14]);
  XLSX.utils.book_append_sheet(wb, ws, "Resumen");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="resumen-${period}.xlsx"`,
    },
  });
}
