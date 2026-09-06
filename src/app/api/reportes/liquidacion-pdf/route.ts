// Resumen de LIQUIDACIÓN (PDF o Excel) — diferente del resumen de ventas.
// Muestra: período, vueltas válidas, pago al chofer, gastos reembolsables,
// descuentos, efectivo a entregar, saldo final.
// GET /api/reportes/liquidacion-pdf?formato=pdf|excel&offset=0
import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { formatCurrency, formatNumber, formatDate, formatDateTime, labelTipoGasto, esVueltaCompletada, labelMetodoPago } from "@/lib/helpers";

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

    // Calcular rango del período (usar zona horaria Chile)
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
    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const totalTransferencia = entregas.reduce((s, e) => s + e.montoTransferencia, 0);
    const totalRecibido = totalEfectivo + totalTransferencia;
    const totalPagosSueltos = pagosSueltos.reduce((s, p) => s + p.monto, 0);
    const pagosSueltosEfectivoChofer = pagosSueltos
      .filter(p => p.metodoPago === "efectivo" && (esChofer ? p.choferId === session.userId : p.choferId))
      .reduce((s, p) => s + p.monto, 0);
    const pagosSueltosTransferencia = pagosSueltos.filter(p => p.metodoPago === "transferencia").reduce((s, p) => s + p.monto, 0);
    const efectivoTotal = totalEfectivo + pagosSueltosEfectivoChofer;
    const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
    const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
    const gastosDueno = gastos.filter(g => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);
    const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
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

    // Detalle de vueltas
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
      periodoLabel: label,
      cfg,
      session,
      resumen: {
        totalVentas, totalEfectivo, totalTransferencia, totalRecibido,
        totalLitros, totalEntregas: entregas.length, totalGastos,
        gastosChofer, gastosDueno, descuentosChofer, utilidadBruta,
        pagoChofer, impuesto, liquidoChofer, efectivoTotal, saldoChofer,
        vueltasCompletadas: vueltasValidas.length, vueltasTotal: vueltas.length,
        vueltasUnicoCliente, vueltasMultiple,
        totalPagosSueltos, pagosSueltosEfectivo: pagosSueltosEfectivoChofer,
        pagosSueltosTransferencia,
      },
      vueltas: vueltasDetalle,
      gastos: gastos.map(g => ({
        fecha: g.fecha, tipo: labelTipoGasto(g.tipo), descripcion: g.descripcion,
        monto: g.monto, pagadoPor: g.pagadoPor,
      })),
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
  doc.text(`Administrador: ${cfg.nombreDueno ?? "—"}`, 14, 30);
  doc.text(`Generado: ${formatDateTime(new Date())}`, 14, 35);

  let y = 42;

  // === 1. RESUMEN DE VUELTAS ===
  doc.setFontSize(14);
  doc.text("1. Vueltas del período", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Valor"]],
    body: [
      ["Vueltas válidas", String(r.vueltasCompletadas)],
      ["Total vueltas", String(r.vueltasTotal)],
      ...(cfg.modoLiquidacion === "vuelta" ? [
        ["Cliente único", `${r.vueltasUnicoCliente} × ${formatCurrency(cfg.montoPorVueltaUnicoCliente)}`],
        ["Múltiples clientes", `${r.vueltasMultiple} × ${formatCurrency(cfg.montoPorVueltaMultiple)}`],
      ] : []),
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 2. DETALLE DE VUELTAS ===
  if (data.vueltas.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("2. Detalle de vueltas", 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["#", "Camión", "Entregas", "Litros", "Ventas", "Efectivo", "Transfer.", "Estado"]],
      body: data.vueltas.map((v: any) => [
        `#${v.numero}`,
        v.camion,
        String(v.cantidadEntregas),
        `${formatNumber(v.litros, 0)} L`,
        formatCurrency(v.ventas),
        formatCurrency(v.efectivo),
        formatCurrency(v.transferencia),
        v.completada ? "✓ Válida" : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === 3. LIQUIDACIÓN DEL CHOFER ===
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text("3. Liquidación del chofer", 14, y);
  y += 5;
  const liquiBody: any[] = [];
  if (cfg.modoLiquidacion === "vuelta") {
    liquiBody.push(["Pago al chofer", `${r.vueltasCompletadas} vueltas ×`, formatCurrency(r.pagoChofer)]);
  } else {
    liquiBody.push(["Pago al chofer", `${cfg.porcentajeComisionChofer}% utilidad`, formatCurrency(r.pagoChofer)]);
  }
  liquiBody.push(["+ Gastos reembolsables (chofer)", "", formatCurrency(r.gastosChofer)]);
  if (r.descuentosChofer > 0) liquiBody.push(["- Descuentos", "", formatCurrency(r.descuentosChofer)]);
  if (r.impuesto > 0) liquiBody.push(["- Impuesto", `${cfg.tipoTributo} ${cfg.porcentajeImpuesto}%`, formatCurrency(r.impuesto)]);
  liquiBody.push(["= Líquido a recibir", "", formatCurrency(r.liquidoChofer)]);
  liquiBody.push(["- Efectivo en mano", "", formatCurrency(r.efectivoTotal)]);
  liquiBody.push([
    r.saldoChofer >= 0 ? "= Te deben" : "= Debés entregar",
    "",
    formatCurrency(Math.abs(r.saldoChofer)),
  ]);
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Detalle", "Monto"]],
    body: liquiBody,
    theme: "striped",
    headStyles: { fillColor: [16, 185, 129], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 50 }, 2: { cellWidth: 40, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 4. RESUMEN FINANCIERO ===
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFontSize(14);
  doc.text("4. Resumen financiero", 14, y);
  y += 5;
  autoTable(doc, {
    startY: y,
    head: [["Concepto", "Monto"]],
    body: [
      ["Total ventas", formatCurrency(r.totalVentas)],
      ["Litros entregados", `${formatNumber(r.totalLitros, 0)} L`],
      ["Efectivo de entregas", formatCurrency(r.totalEfectivo)],
      ["Transferencia de entregas", formatCurrency(r.totalTransferencia)],
      ...(r.totalPagosSueltos > 0 ? [
        ["Pagos sueltos (efectivo)", formatCurrency(r.pagosSueltosEfectivo)],
        ["Pagos sueltos (transferencia)", formatCurrency(r.pagosSueltosTransferencia)],
      ] : []),
      ["Total gastos", formatCurrency(r.totalGastos)],
      ["  - Gastos del chofer", formatCurrency(r.gastosChofer)],
      ["  - Gastos del admin", formatCurrency(r.gastosDueno)],
      ["Utilidad bruta", formatCurrency(r.utilidadBruta)],
    ],
    theme: "striped",
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 60, halign: "right" } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // === 5. GASTOS DETALLADOS ===
  if (data.gastos.length > 0) {
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFontSize(14);
    doc.text("5. Gastos del período", 14, y);
    y += 5;
    // Agrupar por tipo
    const gastosAgrupados = new Map<string, { monto: number; notas: string[]; count: number }>();
    for (const g of data.gastos) {
      const ex = gastosAgrupados.get(g.tipo) ?? { monto: 0, notas: [], count: 0 };
      ex.monto += g.monto;
      ex.count += 1;
      if (g.descripcion) ex.notas.push(g.descripcion);
      gastosAgrupados.set(g.tipo, ex);
    }
    autoTable(doc, {
      startY: y,
      head: [["Tipo", "Cant.", "Descripción", "Pagado por", "Monto"]],
      body: Array.from(gastosAgrupados.entries()).map(([tipo, info]) => [
        tipo,
        String(info.count),
        info.notas.join("; "),
        "",
        formatCurrency(info.monto),
      ]),
      theme: "striped",
      headStyles: { fillColor: [220, 38, 38], fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      foot: [["", "", "", "Total", formatCurrency(r.totalGastos)]],
    });
  }

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
    [`Administrador: ${cfg.nombreDueno ?? "—"}`],
    [`Generado: ${formatDateTime(new Date())}`],
    [],
    ["1. VUELTAS DEL PERÍODO"],
    ["Concepto", "Valor"],
    ["Vueltas válidas", r.vueltasCompletadas],
    ["Total vueltas", r.vueltasTotal],
    ...(cfg.modoLiquidacion === "vuelta" ? [
      ["Cliente único", `${r.vueltasUnicoCliente} × ${cfg.montoPorVueltaUnicoCliente}`],
      ["Múltiples clientes", `${r.vueltasMultiple} × ${cfg.montoPorVueltaMultiple}`],
    ] : []),
    [],
    ["2. DETALLE DE VUELTAS"],
    ["#", "Camión", "Entregas", "Litros", "Ventas", "Efectivo", "Transferencia", "Estado"],
    ...data.vueltas.map((v: any) => [`#${v.numero}`, v.camion, v.cantidadEntregas, v.litros, v.ventas, v.efectivo, v.transferencia, v.completada ? "Válida" : "—"]),
    [],
    ["3. LIQUIDACIÓN DEL CHOFER"],
    ["Concepto", "Detalle", "Monto"],
    [cfg.modoLiquidacion === "vuelta" ? "Pago al chofer" : "Pago al chofer",
     cfg.modoLiquidacion === "vuelta" ? `${r.vueltasCompletadas} vueltas` : `${cfg.porcentajeComisionChofer}% utilidad`,
     r.pagoChofer],
    ["+ Gastos reembolsables (chofer)", "", r.gastosChofer],
    ...(r.descuentosChofer > 0 ? [["- Descuentos", "", r.descuentosChofer]] : []),
    ...(r.impuesto > 0 ? [["- Impuesto", `${cfg.tipoTributo} ${cfg.porcentajeImpuesto}%`, r.impuesto]] : []),
    ["= Líquido a recibir", "", r.liquidoChofer],
    ["- Efectivo en mano", "", r.efectivoTotal],
    [r.saldoChofer >= 0 ? "= Te deben" : "= Debés entregar", "", Math.abs(r.saldoChofer)],
    [],
    ["4. RESUMEN FINANCIERO"],
    ["Concepto", "Monto"],
    ["Total ventas", r.totalVentas],
    ["Litros entregados", r.totalLitros],
    ["Efectivo de entregas", r.totalEfectivo],
    ["Transferencia de entregas", r.totalTransferencia],
    ...(r.totalPagosSueltos > 0 ? [
      ["Pagos sueltos (efectivo)", r.pagosSueltosEfectivo],
      ["Pagos sueltos (transferencia)", r.pagosSueltosTransferencia],
    ] : []),
    ["Total gastos", r.totalGastos],
    ["  - Gastos del chofer", r.gastosChofer],
    ["  - Gastos del admin", r.gastosDueno],
    ["Utilidad bruta", r.utilidadBruta],
    [],
    ["5. GASTOS DETALLADOS"],
    ["Tipo", "Cant.", "Descripción", "Monto"],
    ...(() => {
      const agrupado = new Map<string, { monto: number; notas: string[]; count: number }>();
      for (const g of data.gastos) {
        const ex = agrupado.get(g.tipo) ?? { monto: 0, notas: [], count: 0 };
        ex.monto += g.monto;
        ex.count += 1;
        if (g.descripcion) ex.notas.push(g.descripcion);
        agrupado.set(g.tipo, ex);
      }
      return Array.from(agrupado.entries()).map(([tipo, info]) => [tipo, info.count, info.notas.join("; "), info.monto]);
    })(),
    ["", "", "Total", r.totalGastos],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [28, 18, 14, 14, 14, 14].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidacion-${data.periodoLabel}.xlsx"`,
    },
  });
}
