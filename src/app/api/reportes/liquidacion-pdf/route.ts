// Resumen de LIQUIDACIÓN (PDF o Excel) — versión simplificada.
// Solo incluye:
//   1. Vueltas pagables (detalle + total)
//   2. Gastos por tipo (agrupado)
//   3. Efectivo recibido (entregas + pagos sueltos)
//   4. Imposiciones (impuestos) si existen
//   5. Resumen final (pago chofer, efectivo en mano, saldo)
// GET /api/reportes/liquidacion-pdf?formato=pdf|excel&offset=0
import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { formatCurrency, formatNumber, formatDateTime, labelTipoGasto, esVueltaCompletada } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const duenoId = await getDuenoId();
    if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const formato = searchParams.get("formato") || "pdf";
    const offset = Number(searchParams.get("offset") || 0);

    const config = await db.configuracion.findUnique({ where: { duenoId } });
    const cfg: any = config ?? {
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
    };

    const periodo = cfg.periodoLiquidacion || "mensual";

    // Calcular rango del período (zona horaria Chile)
    function getPeriodoRange(offsetNum: number): { start: Date; end: Date; label: string } {
      const nowCL = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
      if (periodo === "semanal") {
        const today = new Date(nowCL.getFullYear(), nowCL.getMonth(), nowCL.getDate());
        const todayDow = today.getDay();
        const startCurrent = new Date(today);
        startCurrent.setDate(today.getDate() - todayDow + 7 * offsetNum);
        const start = new Date(Date.UTC(startCurrent.getFullYear(), startCurrent.getMonth(), startCurrent.getDate(), 4, 0, 0));
        const endCierreCL = new Date(startCurrent);
        endCierreCL.setDate(startCurrent.getDate() + 6);
        const end = new Date(Date.UTC(endCierreCL.getFullYear(), endCierreCL.getMonth(), endCierreCL.getDate() + 1, 4, 0, 0));
        const label = `Semana ${startCurrent.getDate()}/${startCurrent.getMonth() + 1} - ${endCierreCL.getDate()}/${endCierreCL.getMonth() + 1}/${endCierreCL.getFullYear()}`;
        return { start, end, label };
      } else {
        const baseMonth = nowCL.getMonth() + offsetNum;
        const baseYear = nowCL.getFullYear();
        const adjustedDate = new Date(baseYear, baseMonth, 1);
        const start = new Date(Date.UTC(adjustedDate.getFullYear(), adjustedDate.getMonth(), 1, 4, 0, 0));
        const end = new Date(Date.UTC(adjustedDate.getFullYear(), adjustedDate.getMonth() + 1, 1, 4, 0, 0));
        const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const label = `${monthNames[adjustedDate.getMonth()]} ${adjustedDate.getFullYear()}`;
        return { start, end, label };
      }
    }

    const { start, end, label } = getPeriodoRange(offset);

    // Cargar datos
    const esChofer = session.role === "chofer";
    const entregaWhere = { duenoId, fecha: { gte: start, lt: end }, ...(esChofer ? { choferId: session.userId } : {}) };
    const gastoWhere = { duenoId, fecha: { gte: start, lt: end }, ...(esChofer ? { choferId: session.userId } : {}) };
    const vueltaWhere = { duenoId, iniciadaEn: { gte: start, lt: end }, ...(esChofer ? { choferId: session.userId } : {}) };

    const [entregas, gastos, vueltas, pagosSueltos] = await Promise.all([
      db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" }, include: { vuelta: { select: { numero: true } } } }),
      db.gasto.findMany({ where: gastoWhere, orderBy: { fecha: "desc" } }),
      db.vuelta.findMany({
        where: vueltaWhere,
        include: {
          camion: { select: { nombre: true, capacidad: true } },
          chofer: { select: { nombre: true } },
          entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, clienteNombre: true } },
        },
        orderBy: { iniciadaEn: "desc" },
      }),
      db.pago.findMany({
        where: { duenoId, fecha: { gte: start, lt: end } },
        orderBy: { fecha: "desc" },
        include: { cliente: { select: { nombre: true } } },
      }),
    ]);

    // Cálculos
    const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const pagosSueltosEfectivoChofer = pagosSueltos
      .filter(p => p.metodoPago === "efectivo" && (esChofer ? p.choferId === session.userId : p.choferId))
      .reduce((s, p) => s + p.monto, 0);
    const efectivoTotal = totalEfectivo + pagosSueltosEfectivoChofer;
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
    const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
    const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const utilidadBruta = totalVentas - totalGastos;

    // Pago al chofer + vueltas válidas
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
      vueltasUnicoCliente = vueltasValidas.filter(v => v.entregas.length <= 1).length;
      vueltasMultiple = vueltasValidas.filter(v => v.entregas.length > 1).length;
      pagoChofer = vueltasValidas.reduce((s, v) => {
        const esMultiple = v.entregas.length > 1;
        return s + (esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente);
      }, 0);
    } else {
      pagoChofer = (utilidadBruta * cfg.porcentajeComisionChofer) / 100;
    }

    // Imposiciones (impuestos)
    const baseImponible = cfg.aplicaImpuestoSobre === "pago_chofer" ? pagoChofer : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? utilidadBruta : totalVentas;
    const impuesto = cfg.tipoTributo === "ninguno" ? 0 : (Math.max(0, baseImponible) * cfg.porcentajeImpuesto) / 100;
    const liquidoChofer = Math.max(0, pagoChofer) + gastosChofer - impuesto - descuentosChofer;
    const saldoChofer = liquidoChofer - efectivoTotal;

    // Detalle de vueltas pagables (solo las válidas)
    const vueltasPagables = vueltasValidas.map(v => {
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const esMultiple = v.entregas.length > 1;
      const pagoVuelta = esMultiple ? cfg.montoPorVueltaMultiple : cfg.montoPorVueltaUnicoCliente;
      return {
        numero: v.numero,
        camion: v.camion?.nombre || "—",
        cantidadEntregas: v.entregas.length,
        litros,
        tipo: esMultiple ? "Múltiple" : "Cliente único",
        pago: pagoVuelta,
      };
    });

    // Gastos agrupados por tipo
    const gastosPorTipoMap = new Map<string, { monto: number; count: number }>();
    for (const g of gastos) {
      const tipo = labelTipoGasto(g.tipo);
      const ex = gastosPorTipoMap.get(tipo) ?? { monto: 0, count: 0 };
      ex.monto += g.monto;
      ex.count += 1;
      gastosPorTipoMap.set(tipo, ex);
    }
    const gastosPorTipo = Array.from(gastosPorTipoMap.entries())
      .map(([tipo, info]) => ({ tipo, count: info.count, monto: info.monto }))
      .sort((a, b) => b.monto - a.monto);

    const data = {
      periodoLabel: label,
      cfg,
      resumen: {
        pagoChofer, vueltasCompletadas: vueltasValidas.length,
        vueltasUnicoCliente, vueltasMultiple,
        gastosChofer, descuentosChofer,
        impuesto, tipoTributo: cfg.tipoTributo, porcentajeImpuesto: cfg.porcentajeImpuesto,
        liquidoChofer, efectivoTotal, saldoChofer,
        totalGastos,
      },
      vueltasPagables,
      gastosPorTipo,
    };

    if (formato === "excel") {
      return generarExcel(data);
    }
    return generarPDF(data);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Error al generar liquidación PDF:", err);
    return NextResponse.json(
      { error: `Error al generar liquidación: ${errorMsg}` },
      { status: 500 }
    );
  }
}

function generarPDF(data: any) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const r = data.resumen;
  const cfg = data.cfg;

  // Encabezado
  doc.setFontSize(18);
  doc.text(`Liquidación — ${data.periodoLabel}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Chofer: ${cfg.nombreChofer ?? "—"}`, 14, 25);
  doc.text(`Generado: ${formatDateTime(new Date())}`, 14, 30);

  let y = 38;

  // === 1. VUELTAS PAGABLES ===
  doc.setFontSize(13);
  doc.text(`1. Vueltas pagables (${r.vueltasCompletadas})`, 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Vuelta", "Camión", "Entregas", "Litros", "Tipo", "Pago"]],
    body: data.vueltasPagables.map((v: any) => [
      `#${v.numero}`,
      v.camion,
      String(v.cantidadEntregas),
      `${formatNumber(v.litros, 0)} L`,
      v.tipo,
      formatCurrency(v.pago),
    ]),
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    foot: [[
      "TOTAL",
      "",
      "",
      "",
      `${r.vueltasUnicoCliente} único + ${r.vueltasMultiple} múltiples`,
      formatCurrency(r.pagoChofer),
    ]],
    footStyles: { fillColor: [37, 99, 235], fontSize: 9 },
    columnStyles: { 5: { halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // === 2. GASTOS POR TIPO ===
  if (data.gastosPorTipo.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("2. Gastos por tipo", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Cant.", "Monto"]],
      body: data.gastosPorTipo.map((g: any) => [
        g.tipo,
        String(g.count),
        formatCurrency(g.monto),
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      foot: [["Total", "", formatCurrency(r.totalGastos)]],
      footStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      columnStyles: { 2: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === 3. EFECTIVO RECIBIDO ===
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.text("3. Efectivo recibido", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: [
      ["Efectivo total (entregas + pagos sueltos)", formatCurrency(r.efectivoTotal)],
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // === 4. IMPOSICIONES (solo si existen) ===
  if (r.impuesto > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.text("4. Imposiciones", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Detalle", "Monto"]],
      body: [
        [r.tipoTributo === "iva" ? "IVA" : r.tipoTributo === "iibb" ? "IIBB" : "Impuesto",
         `${r.porcentajeImpuesto}%`,
         formatCurrency(r.impuesto)],
      ],
      theme: "striped",
      headStyles: { fillColor: [234, 179, 8], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 2: { halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === 5. RESUMEN FINAL ===
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.text("Resumen", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: [
      ["Pago por vueltas", formatCurrency(r.pagoChofer)],
      ...(r.gastosChofer > 0 ? [["+ Gastos reembolsables", formatCurrency(r.gastosChofer)]] : []),
      ...(r.descuentosChofer > 0 ? [["- Descuentos", formatCurrency(r.descuentosChofer)]] : []),
      ...(r.impuesto > 0 ? [[`- ${r.tipoTributo === "iva" ? "IVA" : r.tipoTributo === "iibb" ? "IIBB" : "Impuesto"}`, formatCurrency(r.impuesto)]] : []),
      ["= Líquido a recibir", formatCurrency(r.liquidoChofer)],
      ["- Efectivo en mano", formatCurrency(r.efectivoTotal)],
      [
        r.saldoChofer >= 0 ? "= Te deben" : "= Debés entregar",
        formatCurrency(Math.abs(r.saldoChofer)),
      ],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right", cellWidth: 60 } },
  });

  const pdfBuffer = doc.output("arraybuffer");
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="liquidacion-${data.periodoLabel}-${Date.now()}.pdf"`,
    },
  });
}

function generarExcel(data: any) {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();
  const r = data.resumen;
  const cfg = data.cfg;

  const rows: any[] = [
    [`Liquidación — ${data.periodoLabel}`],
    [`Chofer: ${cfg.nombreChofer ?? "—"}`],
    [`Generado: ${formatDateTime(new Date())}`],
    [],
    [`1. VUELTAS PAGABLES (${r.vueltasCompletadas})`],
    ["Vuelta", "Camión", "Entregas", "Litros", "Tipo", "Pago"],
    ...data.vueltasPagables.map((v: any) => [`#${v.numero}`, v.camion, v.cantidadEntregas, v.litros, v.tipo, v.pago]),
    ["TOTAL", "", "", "", `${r.vueltasUnicoCliente} único + ${r.vueltasMultiple} múltiples`, r.pagoChofer],
    [],
  ];

  if (data.gastosPorTipo.length > 0) {
    rows.push(["2. GASTOS POR TIPO"]);
    rows.push(["Tipo", "Cant.", "Monto"]);
    rows.push(...data.gastosPorTipo.map((g: any) => [g.tipo, g.count, g.monto]));
    rows.push(["Total", "", r.totalGastos]);
    rows.push([]);
  }

  rows.push(["3. EFECTIVO RECIBIDO"]);
  rows.push(["Concepto", "Monto"]);
  rows.push(["Efectivo total (entregas + pagos sueltos)", r.efectivoTotal]);
  rows.push([]);

  if (r.impuesto > 0) {
    rows.push(["4. IMPOSICIONES"]);
    rows.push(["Concepto", "Detalle", "Monto"]);
    rows.push([r.tipoTributo === "iva" ? "IVA" : r.tipoTributo === "iibb" ? "IIBB" : "Impuesto", `${r.porcentajeImpuesto}%`, r.impuesto]);
    rows.push([]);
  }

  rows.push(["RESUMEN"]);
  rows.push(["Concepto", "Monto"]);
  rows.push(["Pago por vueltas", r.pagoChofer]);
  if (r.gastosChofer > 0) rows.push(["+ Gastos reembolsables", r.gastosChofer]);
  if (r.descuentosChofer > 0) rows.push(["- Descuentos", r.descuentosChofer]);
  if (r.impuesto > 0) rows.push([`- ${r.tipoTributo === "iva" ? "IVA" : r.tipoTributo === "iibb" ? "IIBB" : "Impuesto"}`, r.impuesto]);
  rows.push(["= Líquido a recibir", r.liquidoChofer]);
  rows.push(["- Efectivo en mano", r.efectivoTotal]);
  rows.push([r.saldoChofer >= 0 ? "= Te deben" : "= Debés entregar", Math.abs(r.saldoChofer)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [24, 16, 12, 14, 22, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidacion-${data.periodoLabel}.xlsx"`,
    },
  });
}
