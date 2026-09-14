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
    // Vueltas: usar cerradaEn si está cerrada, iniciadaEn si está activa
    const choferFilter = esChofer ? { choferId: session.userId } : {};
    const vueltaWhere = {
      duenoId,
      ...choferFilter,
      OR: [
        { activa: false, cerradaEn: { gte: start, lt: end } },
        { activa: true, iniciadaEn: { gte: start, lt: end } },
      ],
    };

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
    // Efectivo total = efectivo de entregas + TODOS los pagos sueltos en efectivo del período.
    // No filtrar por choferId: si el chofer es el único trabajando, todo el efectivo
    // lo recibió él. Los pagos sin choferId (registrados por admin o sin asignar)
    // también cuentan porque el efectivo físico está en manos del chofer.
    const totalEfectivo = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
    const pagosSueltosEfectivo = pagosSueltos
      .filter(p => p.metodoPago === "efectivo")
      .reduce((s, p) => s + p.monto, 0);
    const efectivoTotal = totalEfectivo + pagosSueltosEfectivo;
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
  const impuestoLabel = r.tipoTributo === "iva" ? "IVA" : r.tipoTributo === "iibb" ? "IIBB" : "Impuesto";
  // El saldo: si es positivo, "Te deben" (a favor del chofer); si negativo, "Debés entregar"
  const saldoLabel = r.saldoChofer >= 0 ? "A favor del chofer" : "A favor del admin";

  // Encabezado
  doc.setFontSize(16);
  doc.text(`Liquidación — ${data.periodoLabel}`, 14, 18);
  doc.setFontSize(9);
  doc.text(`Chofer: ${cfg.nombreChofer ?? "—"}`, 14, 24);

  // Construir una sola tabla con los 4 bloques que pidió el usuario:
  // 1. Vueltas por tipo
  // 2. Gastos por tipo
  // 3. Efectivo recibido (incluye descuentos que el chofer hizo al cliente, que se suman al efectivo)
  // 4. Imposición (si existe)
  // Y al final: Total a favor de quien
  const body: any[][] = [];

  // === 1. VUELTAS POR TIPO ===
  body.push([{ content: "VUELTAS POR TIPO", colSpan: 2, styles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 9 } }]);
  if (r.vueltasUnicoCliente > 0) {
    body.push([`Cliente único (${r.vueltasUnicoCliente} × ${formatCurrency(cfg.montoPorVueltaUnicoCliente)})`, formatCurrency(r.vueltasUnicoCliente * cfg.montoPorVueltaUnicoCliente)]);
  }
  if (r.vueltasMultiple > 0) {
    body.push([`Múltiples clientes (${r.vueltasMultiple} × ${formatCurrency(cfg.montoPorVueltaMultiple)})`, formatCurrency(r.vueltasMultiple * cfg.montoPorVueltaMultiple)]);
  }
  body.push(["Total vueltas", formatCurrency(r.pagoChofer)]);

  // === 2. GASTOS POR TIPO ===
  if (data.gastosPorTipo.length > 0) {
    body.push([{ content: "GASTOS POR TIPO", colSpan: 2, styles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: "bold", fontSize: 9 } }]);
    for (const g of data.gastosPorTipo) {
      body.push([g.tipo, formatCurrency(g.monto)]);
    }
    body.push(["Total gastos", formatCurrency(r.gastosChofer)]);
  }

  // === 3. EFECTIVO RECIBIDO ===
  // Una sola línea: efectivo de entregas + descuentos que el chofer hizo al cliente
  // (esos descuentos se quedan en efectivo del chofer, así que se suman al total).
  const efectivoConDescuentos = r.efectivoTotal + r.descuentosChofer;
  body.push([{ content: "EFECTIVO RECIBIDO", colSpan: 2, styles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: "bold", fontSize: 9 } }]);
  body.push(["Efectivo", formatCurrency(efectivoConDescuentos)]);

  // === 4. IMPOSICIÓN (si existe) ===
  if (r.impuesto > 0) {
    body.push([{ content: "IMPOSICIÓN", colSpan: 2, styles: { fillColor: [234, 179, 8], textColor: 255, fontStyle: "bold", fontSize: 9 } }]);
    body.push([`${impuestoLabel} (${r.porcentajeImpuesto}%)`, formatCurrency(r.impuesto)]);
  }

  // === TOTAL A FAVOR DE QUIEN ===
  // Saldo = lo que el chofer debe recibir (pago vueltas + gastos reembolsables - impuesto)
  //         - lo que ya tiene en efectivo (incluyendo descuentos a favor)
  const saldoFinal = r.liquidoChofer - efectivoConDescuentos;
  body.push([{ content: "TOTAL", colSpan: 2, styles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 10 } }]);
  body.push([saldoFinal >= 0 ? "A favor del chofer" : "A favor del admin", formatCurrency(Math.abs(saldoFinal))]);

  autoTable(doc, {
    startY: 30,
    body,
    theme: "plain",
    bodyStyles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 60, halign: "right" },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (hookData: any) => {
      const rowIndex = hookData.row.index;
      const rowData = body[rowIndex];
      if (!rowData) return;
      // Destacar filas de total
      const label = typeof rowData[0] === "string" ? rowData[0] : "";
      const content = rowData[0]?.content;
      if (label === "Total vueltas" || label === "Total gastos") {
        hookData.cell.styles.fontStyle = "bold";
      }
      if (content === "TOTAL") {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 11;
      }
      if (label === "A favor del chofer" || label === "A favor del admin") {
        hookData.cell.styles.fontStyle = "bold";
        hookData.cell.styles.fontSize = 12;
        hookData.cell.styles.textColor = saldoFinal >= 0 ? [22, 163, 74] : [220, 38, 38];
      }
    },
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
  const impuestoLabel = r.tipoTributo === "iva" ? "IVA" : r.tipoTributo === "iibb" ? "IIBB" : "Impuesto";
  const efectivoConDescuentos = r.efectivoTotal + r.descuentosChofer;
  const saldoFinal = r.liquidoChofer - efectivoConDescuentos;

  const rows: any[] = [
    [`Liquidación — ${data.periodoLabel}`],
    [`Chofer: ${cfg.nombreChofer ?? "—"}`],
    [],
    ["VUELTAS POR TIPO", ""],
  ];

  if (r.vueltasUnicoCliente > 0) {
    rows.push([`Cliente único (${r.vueltasUnicoCliente} × ${cfg.montoPorVueltaUnicoCliente})`, r.vueltasUnicoCliente * cfg.montoPorVueltaUnicoCliente]);
  }
  if (r.vueltasMultiple > 0) {
    rows.push([`Múltiples clientes (${r.vueltasMultiple} × ${cfg.montoPorVueltaMultiple})`, r.vueltasMultiple * cfg.montoPorVueltaMultiple]);
  }
  rows.push(["Total vueltas", r.pagoChofer]);
  rows.push([]);

  if (data.gastosPorTipo.length > 0) {
    rows.push(["GASTOS POR TIPO", ""]);
    for (const g of data.gastosPorTipo) {
      rows.push([g.tipo, g.monto]);
    }
    rows.push(["Total gastos", r.gastosChofer]);
    rows.push([]);
  }

  rows.push(["EFECTIVO RECIBIDO", ""]);
  rows.push(["Efectivo", efectivoConDescuentos]);
  rows.push([]);

  if (r.impuesto > 0) {
    rows.push(["IMPOSICIÓN", ""]);
    rows.push([`${impuestoLabel} (${r.porcentajeImpuesto}%)`, r.impuesto]);
    rows.push([]);
  }

  rows.push(["TOTAL", ""]);
  rows.push([saldoFinal >= 0 ? "A favor del chofer" : "A favor del admin", Math.abs(saldoFinal)]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 38 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidacion-${data.periodoLabel}.xlsx"`,
    },
  });
}
