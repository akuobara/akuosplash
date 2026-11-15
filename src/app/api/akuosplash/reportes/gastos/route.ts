// GET /api/akuosplash/reportes/gastos?formato=pdf|excel&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Informe de gastos por período (un día o rango) — AkuoSplash
import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPeriodRange } from "@/lib/akuosplash-period";
import { labelTipoGasto, labelMetodoPago } from "@/components/akuosplash/akuosplash-helpers";
import { generarReporteGastos, labelPeriodo } from "@/lib/gastos-reporte";

export async function GET(req: NextRequest) {
  try {
    const user = await akuoGetCurrentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.rol !== "transportista" && user.rol !== "superadmin") {
      return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const formato = (searchParams.get("formato") || "pdf") as "pdf" | "excel";
    const desde = searchParams.get("desde") || "";
    const hasta = searchParams.get("hasta") || "";

    // Construir período: custom:desde:hasta (rango) o custom:desde (un día) o todo
    let period = "todo";
    if (desde && hasta) period = `custom:${desde}:${hasta}`;
    else if (desde) period = `custom:${desde}`;

    const { start, end } = getPeriodRange(period);

    const gastos = await akuosplashDb.akuoGasto.findMany({
      where: {
        transportistaId: user.id,
        fecha: { gte: start, lte: end },
      },
      orderBy: { fecha: "desc" },
      take: 1000,
    });

    const nombre = user.nombre || user.email || "Transportista";

    // Filas del detalle
    const filas = gastos.map((g) => ({
      fecha: g.fecha,
      tipoLabel: labelTipoGasto(g.tipo),
      descripcion: g.descripcion,
      categoriaLabel: labelMetodoPago(g.metodoPago),
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

    // Totales por método de pago
    const porMetodoMap = new Map<string, number>();
    for (const g of gastos) {
      const m = labelMetodoPago(g.metodoPago);
      porMetodoMap.set(m, (porMetodoMap.get(m) || 0) + g.monto);
    }
    const totalesPorCategoria = Array.from(porMetodoMap.entries())
      .map(([label, monto]) => ({ label: `Subtotal ${label.toLowerCase()}`, monto }))
      .filter((c) => c.monto > 0);

    const totalGeneral = gastos.reduce((s, g) => s + g.monto, 0);

    return generarReporteGastos({
      titulo: "Informe de gastos",
      contexto: "AkuoSplash",
      nombre,
      periodoLabel: labelPeriodo(desde, hasta),
      columnaCategoria: "Método de pago",
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
