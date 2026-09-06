// Resumen de LIQUIDACIÓN (PDF o Excel) — versión simplificada.
// Muestra solo:
//   1. Vueltas pagables (válidas + total)
//   2. Gastos por tipo
//   3. Efectivo recibido
//   4. Imposiciones (impuestos si existen)
//   5. Saldo final (te deben / debés entregar)
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
      db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" } }),
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
    const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
    const pagosSueltosEfectivoChofer = pagosSueltos
      .filter(p => p.metodoPago === "efectivo" && (esChofer ? p.choferId === session.userId : p.choferId))
      .reduce((s, p) => s + p.monto, 0);
    const pagosSueltosTransferencia = pagosSueltos.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);
    const efectivoTotal = totalEfectivo + pagosSueltosEfectivoChofer;
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
    const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
    const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const utilidadBruta = totalVentas - totalGastos;

    // Pago al chofer
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

    const baseImponible = cfg.aplicaImpuestoSobre === "pago_chofer" ? pagoChofer : cfg.aplicaImpuestoSobre === "utilidad_bruta" ? utilidadBruta : totalVentas;
    const impuesto = cfg.tipoTributo === "ninguno" ? 0 : (Math.max(0, baseImponible) * cfg.porcentajeImpuesto) / 100;
    const liquidoChofer = Math.max(0, pagoChofer) + gastosChofer - impuesto - descuentosChofer;
    const saldoChofer = liquidoChofer - efectivoTotal;

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
      .map(([tipo, info]) => ({ tipo, monto: info.monto, count: info.count }))
      .sort((a, b) => b.monto - a.monto);

    const data = {
      periodoLabel: label,
      cfg,
      vueltasValidasCount: vueltasValidas.length,
      vueltasTotal: vueltas.length,
      vueltasUnicoCliente,
      vueltasMultiple,
      pagoChofer,
      gastosChofer,
      descuentosChofer,
      impuesto,
      liquidoChofer,
      efectivoTotal,
      saldoChofer,
      gastosPorTipo,
      totalGastos,
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

  // Encabezado
  doc.setFontSize(18);
  doc.text(`Liquidación — ${data.periodoLabel}`, 14, 18);
  doc.setFontSize(10);
  doc.text(`Chofer: ${data.cfg.nombreChofer ?? "—"}`, 14, 25);
  doc.text(`Administrador: ${data.cfg.nombreDueno ?? "—"}`, 14, 30);
  doc.text(`Generado: ${formatDateTime(new Date())}`, 14, 35);

  let y = 45;

  // === 1. VUELTAS PAGABLES ===
  doc.setFontSize(13);
  doc.text("Vueltas pagables", 14, y);
  y += 5;
  const vueltasBody: any[] = [
    ["Vueltas válidas", String(data.vueltasValidasCount)],
    ["Total vueltas del período", String(data.vueltasTotal)],
  ];
  if (data.cfg.modoLiquidacion === "vuelta") {
    vueltasBody.push([
      "Cliente único",
      `${data.vueltasUnicoCliente} × ${formatCurrency(data.cfg.montoPorVueltaUnicoCliente)}`,
    ]);
    vueltasBody.push([
      "Múltiples clientes",
      `${data.vueltasMultiple} × ${formatCurrency(data.cfg.montoPorVueltaMultiple)}`,
    ]);
    vueltasBody.push(["Total pago por vueltas", formatCurrency(data.pagoChofer)]);
  } else {
    vueltasBody.push([
      "Pago al chofer",
      `${data.cfg.porcentajeComisionChofer}% de utilidad = ${formatCurrency(data.pagoChofer)}`,
    ]);
  }
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: vueltasBody,
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // === 2. GASTOS POR TIPO ===
  if (data.gastosPorTipo.length > 0) {
    doc.setFontSize(13);
    doc.text("Gastos por tipo", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Cantidad", "Monto"]],
      body: data.gastosPorTipo.map((g: any) => [
        g.tipo,
        String(g.count),
        formatCurrency(g.monto),
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 30, halign: "center" }, 2: { cellWidth: 50, halign: "right" } },
      foot: [["Total", "", formatCurrency(data.totalGastos)]],
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === 3. EFECTIVO RECIBIDO ===
  doc.setFontSize(13);
  doc.text("Efectivo recibido", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: [
      ["Efectivo de entregas", formatCurrency(data.efectivoTotal)],
      ...(data.descuentosChofer > 0 ? [["Descuentos del chofer", `-${formatCurrency(data.descuentosChofer)}`]] : []),
    ],
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // === 4. IMPOSICIONES (solo si hay impuesto) ===
  if (data.impuesto > 0) {
    doc.setFontSize(13);
    doc.text("Imposiciones", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Concepto", "Monto"]],
      body: [
        [`${data.cfg.tipoTributo} (${data.cfg.porcentajeImpuesto}%)`, `-${formatCurrency(data.impuesto)}`],
      ],
      theme: "striped",
      headStyles: { fillColor: [234, 179, 8], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === 5. SALDO FINAL ===
  doc.setFontSize(13);
  doc.text("Saldo final", 14, y);
  y += 5;
  const saldoBody: any[] = [
    ["Pago al chofer", formatCurrency(data.pagoChofer)],
    ["+ Gastos reembolsables (chofer)", formatCurrency(data.gastosChofer)],
  ];
  if (data.descuentosChofer > 0) {
    saldoBody.push(["- Descuentos", `-${formatCurrency(data.descuentosChofer)}`]);
  }
  if (data.impuesto > 0) {
    saldoBody.push(["- Imposiciones", `-${formatCurrency(data.impuesto)}`]);
  }
  saldoBody.push(["= Líquido a recibir", formatCurrency(data.liquidoChofer)]);
  saldoBody.push(["- Efectivo en mano", `-${formatCurrency(data.efectivoTotal)}`]);
  saldoBody.push([
    data.saldoChofer >= 0 ? "= Te deben" : "= Debés entregar",
    formatCurrency(Math.abs(data.saldoChofer)),
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: saldoBody,
    theme: "striped",
    headStyles: { fillColor: data.saldoChofer >= 0 ? [16, 185, 129] : [220, 38, 38], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
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

  const rows: any[] = [
    [`Liquidación — ${data.periodoLabel}`],
    [`Chofer: ${data.cfg.nombreChofer ?? "—"}`],
    [`Administrador: ${data.cfg.nombreDueno ?? "—"}`],
    [`Generado: ${formatDateTime(new Date())}`],
    [],
    ["VUELTAS PAGABLES"],
    ["Concepto", "Valor"],
    ["Vueltas válidas", data.vueltasValidasCount],
    ["Total vueltas del período", data.vueltasTotal],
    ...(data.cfg.modoLiquidacion === "vuelta" ? [
      ["Cliente único", `${data.vueltasUnicoCliente} × ${data.cfg.montoPorVueltaUnicoCliente}`],
      ["Múltiples clientes", `${data.vueltasMultiple} × ${data.cfg.montoPorVueltaMultiple}`],
      ["Total pago por vueltas", data.pagoChofer],
    ] : [
      ["Pago al chofer", `${data.cfg.porcentajeComisionChofer}% de utilidad`],
      ["Monto", data.pagoChofer],
    ]),
    [],
    ["GASTOS POR TIPO"],
    ["Tipo", "Cantidad", "Monto"],
    ...data.gastosPorTipo.map((g: any) => [g.tipo, g.count, g.monto]),
    ["Total", "", data.totalGastos],
    [],
    ["EFECTIVO RECIBIDO"],
    ["Concepto", "Monto"],
    ["Efectivo de entregas", data.efectivoTotal],
    ...(data.descuentosChofer > 0 ? [["Descuentos del chofer", -data.descuentosChofer]] : []),
    [],
    ...(data.impuesto > 0 ? [
      ["IMPOSICIONES"],
      ["Concepto", "Monto"],
      [`${data.cfg.tipoTributo} (${data.cfg.porcentajeImpuesto}%)`, -data.impuesto],
      [],
    ] : []),
    ["SALDO FINAL"],
    ["Concepto", "Monto"],
    ["Pago al chofer", data.pagoChofer],
    ["+ Gastos reembolsables (chofer)", data.gastosChofer],
    ...(data.descuentosChofer > 0 ? [["- Descuentos", -data.descuentosChofer]] : []),
    ...(data.impuesto > 0 ? [["- Imposiciones", -data.impuesto]] : []),
    ["= Líquido a recibir", data.liquidoChofer],
    ["- Efectivo en mano", -data.efectivoTotal],
    [data.saldoChofer >= 0 ? "= Te deben" : "= Debés entregar", Math.abs(data.saldoChofer)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [32, 22, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidacion-${data.periodoLabel}.xlsx"`,
    },
  });
}
