import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, formatCurrency, formatNumber, formatDateTime, labelTipoGasto } from "@/lib/helpers";

// Test que replica el flujo completo del resumen.
// Si no hay sesión, devuelve info de diagnóstico sin auth.
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        step: "auth",
        error: "No autenticado (esto es normal — abrí esta URL desde el navegador logueado)",
        hint: "Andá a https://my-project-azure-five-82.vercel.app/ iniciá sesión y luego abrí esta URL en la misma pestaña",
      });
    }

    const duenoId = await getDuenoId();
    if (!duenoId) {
      return NextResponse.json({ step: "duenoId", error: "Sin duenoId", session: { userId: session.userId, role: session.role, duenoId: session.duenoId } });
    }

    const period = "hoy";
    const { start, end } = getRange(period);

    const rangeFilter = { AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}] };
    const entregaWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };
    const gastoWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };

    // Paso 1: cargar datos
    let entregas, gastos, pagos, config;
    try {
      [entregas, gastos, pagos, config] = await Promise.all([
        db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" } }),
        db.gasto.findMany({ where: gastoWhere, orderBy: { fecha: "desc" } }),
        db.pago.findMany({ where: { ...rangeFilter, duenoId }, orderBy: { fecha: "desc" }, include: { cliente: { select: { nombre: true } } } }),
        db.configuracion.findUnique({ where: { duenoId } }),
      ]);
    } catch (dbErr) {
      return NextResponse.json({
        step: "db-query",
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        where: entregaWhere,
      }, { status: 500 });
    }

    // Paso 2: calcular totales
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
    const efectivoTotal = totalEfectivo + pagosSueltosEfectivo;
    const transferenciaTotal = totalTransferencia + pagosSueltosTransferencia;

    // Paso 3: generar PDF
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      doc.setFontSize(18);
      doc.text(`Resumen — test`, 14, 18);
      doc.setFontSize(10);
      doc.text(`Empresa: ${config?.nombreDueno ?? "N/A"}`, 14, 25);

      let y = 32;
      doc.setFontSize(14);
      doc.text("1. Ventas", 14, y);
      y += 5;
      autoTable(doc, {
        startY: y,
        head: [["Concepto", "Valor"]],
        body: [
          ["Total ventas", formatCurrency(totalVentas)],
          ["Litros entregados", `${formatNumber(totalLitros, 0)} L`],
          ["Cantidad de entregas", String(entregas.length)],
          ["Por cobrar del día", formatCurrency(totalPorCobrar)],
        ],
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      const pdfBuffer = doc.output("arraybuffer");
      return new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="test-resumen.pdf"`,
        },
      });
    } catch (pdfErr) {
      return NextResponse.json({
        step: "pdf-generation",
        error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
        stack: pdfErr instanceof Error ? pdfErr.stack?.split("\n").slice(0, 10) : null,
        name: pdfErr instanceof Error ? pdfErr.name : "?",
      }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return NextResponse.json(
      { step: "unknown", error: msg, stack: stack?.split("\n").slice(0, 15), name: err instanceof Error ? err.name : "?" },
      { status: 500 }
    );
  }
}
