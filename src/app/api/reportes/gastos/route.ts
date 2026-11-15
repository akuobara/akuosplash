// GET /api/reportes/gastos?formato=pdf|excel&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Informe de gastos por período (un día o rango) — AljibeApp
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange, labelTipoGasto, labelPagadoPor } from "@/lib/helpers";
import { generarReporteGastos, labelPeriodo } from "@/lib/gastos-reporte";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    const duenoId = await getDuenoId();
    if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const formato = (searchParams.get("formato") || "pdf") as "pdf" | "excel";
    const desde = searchParams.get("desde") || "";
    const hasta = searchParams.get("hasta") || "";

    // Construir período: custom:desde:hasta (rango) o custom:desde (un día) o todo
    let period = "todo";
    if (desde && hasta) period = `custom:${desde}:${hasta}`;
    else if (desde) period = `custom:${desde}`;

    const { start, end } = getRange(period);

    const where: Record<string, unknown> = {
      duenoId,
      AND: [
        start ? { fecha: { gte: start } } : {},
        end ? { fecha: { lt: end } } : {},
      ],
    };
    if (session.role === "chofer") {
      where.choferId = session.userId;
    }

    const [gastos, config] = await Promise.all([
      db.gasto.findMany({ where, orderBy: { fecha: "desc" } }),
      db.configuracion.findUnique({ where: { duenoId } }),
    ]);

    const nombre = config?.nombreDueno || "Dueño";

    // Filas del detalle
    const filas = gastos.map((g) => ({
      fecha: g.fecha,
      tipoLabel: labelTipoGasto(g.tipo),
      descripcion: g.descripcion,
      categoriaLabel: labelPagadoPor(g.pagadoPor),
      monto: g.monto,
    }));

    // Totales por tipo
    const porTipoMap = new Map<string, number>();
    for (const g of gastos) {
      const t = labelTipoGasto(g.tipo);
      porTipoMap.set(t, (porTipoMap.get(t) || 0) + g.monto);
    }
    const totalesPorTipo = Array.from(porTipoMap.entries())
      .map(([tipoLabel, monto]) => ({ tipoLabel, monto }))
      .sort((a, b) => b.monto - a.monto);

    // Totales por categoría (pagado por)
    const totalChofer = gastos.filter((g) => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
    const totalDueno = gastos.filter((g) => g.pagadoPor === "dueno").reduce((s, g) => s + g.monto, 0);
    const totalesPorCategoria = [
      { label: "Subtotal chofer", monto: totalChofer },
      { label: "Subtotal dueño", monto: totalDueno },
    ].filter((c) => c.monto > 0);

    const totalGeneral = gastos.reduce((s, g) => s + g.monto, 0);

    return generarReporteGastos({
      titulo: "Informe de gastos",
      contexto: "AljibeApp",
      nombre,
      periodoLabel: labelPeriodo(desde, hasta),
      columnaCategoria: "Pagado por",
      filas,
      totalesPorTipo,
      totalesPorCategoria,
      totalGeneral,
      formato,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Error al generar informe de gastos:", err);
    return NextResponse.json({ error: `Error al generar informe: ${msg}` }, { status: 500 });
  }
}
