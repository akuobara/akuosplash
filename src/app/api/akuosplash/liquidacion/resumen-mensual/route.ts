import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/liquidacion/resumen-mensual?year=2026&month=10
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") || new Date().getFullYear());
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);

  const inicio = new Date(year, month - 1, 1);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(year, month, 0);
  fin.setHours(23, 59, 59, 999);

  const [entregas, gastos] = await Promise.all([
    akuosplashDb.akuoEntrega.findMany({
      where: { transportistaId: user.id, creadoEn: { gte: inicio, lte: fin } },
      select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true },
    }),
    akuosplashDb.akuoGasto.findMany({
      where: { transportistaId: user.id, fecha: { gte: inicio, lte: fin } },
      select: { monto: true, tipo: true },
    }),
  ]);

  return NextResponse.json({
    year, month,
    label: inicio.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
    totalVentas: entregas.reduce((s, e) => s + e.total, 0),
    totalLitros: entregas.reduce((s, e) => s + e.litros, 0),
    totalEfectivo: entregas.reduce((s, e) => s + (e.montoEfectivo || 0), 0),
    totalTransferencia: entregas.reduce((s, e) => s + (e.montoTransferencia || 0), 0),
    totalGastos: gastos.reduce((s, g) => s + g.monto, 0),
    cantidadEntregas: entregas.length,
    utilidad: entregas.reduce((s, e) => s + e.total, 0) - gastos.reduce((s, g) => s + g.monto, 0),
  });
}
