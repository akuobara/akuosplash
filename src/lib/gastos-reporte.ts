// Generador compartido de informe de gastos (PDF + Excel)
// Usado por /api/reportes/gastos (Aljibe) y /api/akuosplash/reportes/gastos (AkuoSplash)
// Todas las fechas en formato DD/MM/AAAA (es-CL), moneda en $ (es-CL).
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Formato DD/MM/AAAA (Chile) — sin importar de qué helpers venga, el resultado es es-CL
function fmtFecha(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" });
}
function fmtFechaHora(fecha: Date | string): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });
}
function fmtMonto(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n || 0);
}

export interface GastoFilaReporte {
  fecha: Date | string;
  tipoLabel: string;
  descripcion: string | null;
  categoriaLabel: string; // "Chofer"/"Dueño" (Aljibe) o "Efectivo"/"Tarjeta" (Akuo)
  monto: number;
}

export interface GastoTotalPorTipo {
  tipoLabel: string;
  monto: number;
}

export interface GastoTotalPorCategoria {
  label: string; // "Subtotal Chofer", "Subtotal Dueño", etc.
  monto: number;
}

export interface GastosReporteInput {
  titulo: string;                 // "Informe de Gastos"
  contexto: string;               // "AljibeApp" o "AkuoSplash"
  nombre: string;                 // empresa o transportista
  periodoLabel: string;           // "15/11/2026" o "01/11/2026 a 15/11/2026"
  columnaCategoria: string;       // "Pagado por" o "Método de pago"
  filas: GastoFilaReporte[];
  totalesPorTipo: GastoTotalPorTipo[];
  totalesPorCategoria: GastoTotalPorCategoria[];
  totalGeneral: number;
  formato: "pdf" | "excel";
}

export function generarReporteGastos(input: GastosReporteInput): NextResponse {
  const {
    titulo, contexto, nombre, periodoLabel, columnaCategoria,
    filas, totalesPorTipo, totalesPorCategoria, totalGeneral, formato,
  } = input;

  const generadoEn = fmtFechaHora(new Date());

  if (formato === "excel") {
    return generarExcel(input, generadoEn);
  }
  return generarPDF(input, generadoEn);
}

function generarPDF(input: GastosReporteInput, generadoEn: string): NextResponse {
  const { titulo, contexto, nombre, periodoLabel, columnaCategoria, filas, totalesPorTipo, totalesPorCategoria, totalGeneral } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Encabezado
  doc.setFontSize(16);
  doc.text(titulo, 14, 16);
  doc.setFontSize(10);
  doc.text(`${contexto} — ${nombre}`, 14, 22);
  doc.text(`Período: ${periodoLabel}`, 14, 27);
  doc.text(`Generado: ${generadoEn}`, 14, 32);

  let y = 39;

  // === 1. RESUMEN ===
  doc.setFontSize(12);
  doc.text("Resumen", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: [
      ["Total gastos", fmtMonto(totalGeneral)],
      ["Cantidad de registros", String(filas.length)],
      ...totalesPorCategoria.map((c) => [c.label, fmtMonto(c.monto)]),
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 2. GASTOS POR TIPO ===
  if (totalesPorTipo.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.text("Gastos por tipo", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Monto"]],
      body: totalesPorTipo.map((t) => [t.tipoLabel, fmtMonto(t.monto)]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50, halign: "right" } },
      foot: [["Total", fmtMonto(totalGeneral)]],
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === 3. DETALLE DE GASTOS ===
  if (filas.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.text(`Detalle (${filas.length} gastos)`, 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Tipo", "Descripción", columnaCategoria, "Monto"]],
      body: filas.map((g) => [
        fmtFecha(g.fecha),
        g.tipoLabel,
        g.descripcion || "—",
        g.categoriaLabel,
        fmtMonto(g.monto),
      ]),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 38 },
        2: { cellWidth: 50 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30, halign: "right" },
      },
      foot: [["", "", "", "Total", fmtMonto(totalGeneral)]],
      footStyles: { fillColor: [220, 38, 38] },
    });
  }

  const pdfBuffer = doc.output("arraybuffer");
  // Nombre de archivo: slug del período (DD-MM-AAAA)
  const slug = periodoLabel.replace(/[\/: ]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gastos-${slug}.pdf"`,
    },
  });
}

function generarExcel(input: GastosReporteInput, generadoEn: string): NextResponse {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const XLSX = require("xlsx");
  const { titulo, contexto, nombre, periodoLabel, columnaCategoria, filas, totalesPorTipo, totalesPorCategoria, totalGeneral } = input;

  const rows: any[] = [
    [titulo],
    [`${contexto} — ${nombre}`],
    [`Período: ${periodoLabel}`],
    [`Generado: ${generadoEn}`],
    [],
    ["RESUMEN"],
    ["Concepto", "Monto"],
    ["Total gastos", totalGeneral],
    ["Cantidad de registros", filas.length],
    ...totalesPorCategoria.map((c) => [c.label, c.monto]),
    [],
    ["GASTOS POR TIPO"],
    ["Tipo", "Monto"],
    ...totalesPorTipo.map((t) => [t.tipoLabel, t.monto]),
    ["Total", totalGeneral],
    [],
    ["DETALLE DE GASTOS"],
    ["Fecha", "Tipo", "Descripción", columnaCategoria, "Monto"],
    ...filas.map((g) => [
      fmtFecha(g.fecha),
      g.tipoLabel,
      g.descripcion || "",
      g.categoriaLabel,
      g.monto,
    ]),
    ["", "", "", "Total", totalGeneral],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 36 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Gastos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const slug = periodoLabel.replace(/[\/: ]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="gastos-${slug}.xlsx"`,
    },
  });
}

// Construye el label del período a partir de desde/hasta (formato YYYY-MM-DD de los <input type=date>)
// Devuelve DD/MM/AAAA (es-CL) para mostrar en el informe.
export function labelPeriodo(desde: string, hasta: string): string {
  const fmt = (yyyyMmDd: string): string => {
    const d = new Date(yyyyMmDd + "T12:00:00-04:00"); // mediodía Chile para no cruzar día
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Santiago" });
  };
  if (!desde && !hasta) return "Todo";
  if (desde && hasta && desde !== hasta) return `${fmt(desde)} a ${fmt(hasta)}`;
  return fmt(desde || hasta);
}
