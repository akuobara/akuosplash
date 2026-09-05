import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, formatCurrency, formatNumber, formatDateTime, labelTipoGasto } from "@/lib/helpers";

// Test que replica el flujo completo del resumen con datos reales
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ step: "auth", error: "No autenticado" }, { status: 401 });
    }
    const duenoId = await getDuenoId();
    if (!duenoId) {
      return NextResponse.json({ step: "duenoId", error: "Sin duenoId", session }, { status: 401 });
    }

    const period = "hoy";
    const { start, end } = getRange(period);
    return NextResponse.json({
      step: "getRange",
      start: start?.toISOString(),
      end: end?.toISOString(),
      duenoId,
      role: session.role,
      userId: session.userId,
    });

    // El código siguiente no se ejecuta en este test — solo diagnosticamos getRange
    /* eslint-disable */
    const rangeFilter = { AND: [start ? { fecha: { gte: start } } : {}, end ? { fecha: { lt: end } } : {}] };
    const entregaWhere = { ...rangeFilter, duenoId, ...(session.role === "chofer" ? { choferId: session.userId } : {}) };

    const [entregas, gastos, pagos, config] = await Promise.all([
      db.entrega.findMany({ where: entregaWhere, orderBy: { fecha: "desc" } }),
      db.gasto.findMany({ where: entregaWhere, orderBy: { fecha: "desc" } }),
      db.pago.findMany({ where: { ...rangeFilter, duenoId }, orderBy: { fecha: "desc" }, include: { cliente: { select: { nombre: true } } } }),
      db.configuracion.findUnique({ where: { duenoId } }),
    ]);

    return NextResponse.json({
      step: "data-loaded",
      entregasCount: entregas.length,
      gastosCount: gastos.length,
      pagosCount: pagos.length,
      hasConfig: !!config,
      primeraEntrega: entregas[0] ? {
        id: entregas[0].id,
        clienteNombre: entregas[0].clienteNombre,
        litros: entregas[0].litros,
        total: entregas[0].total,
        metodoPago: entregas[0].metodoPago,
      } : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    return NextResponse.json(
      { error: msg, stack: stack?.split("\n").slice(0, 15), name: err instanceof Error ? err.name : "?" },
      { status: 500 }
    );
  }
}
