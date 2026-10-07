import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPeriodRange } from "@/lib/akuosplash-period";

// GET /api/akuosplash/reportes/resumen?period=hoy — resumen de stats para el dashboard
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "hoy";
  const { start, end } = getPeriodRange(period);

  // Buscar todas las entregas del período
  const entregas = await akuosplashDb.akuoEntrega.findMany({
    where: {
      transportistaId: user.id,
      creadoEn: { gte: start, lte: end },
    },
    select: {
      litros: true,
      total: true,
      montoEfectivo: true,
      montoTransferencia: true,
      montoRecibido: true,
      estadoPago: true,
      descuento: true,
    },
  });

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivoRecibido = entregas.reduce((s, e) => s + (e.montoEfectivo || 0), 0);
  const totalTransferenciaRecibida = entregas.reduce((s, e) => s + (e.montoTransferencia || 0), 0);
  const totalRecibido = entregas.reduce((s, e) => s + (e.montoRecibido || 0), 0);
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalPorCobrar = totalVentas - totalRecibido;
  const cantidadEntregas = entregas.length;

  // Gastos del período
  const gastos = await akuosplashDb.akuoGasto.findMany({
    where: {
      transportistaId: user.id,
      fecha: { gte: start, lte: end },
    },
    select: { monto: true, tipo: true },
  });
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

  // Gastos por tipo
  const gastosPorTipo: Record<string, number> = {};
  gastos.forEach(g => {
    gastosPorTipo[g.tipo] = (gastosPorTipo[g.tipo] || 0) + g.monto;
  });

  // Vueltas del período
  const vueltas = await akuosplashDb.akuoVuelta.findMany({
    where: {
      transportistaId: user.id,
      iniciadaEn: { gte: start, lte: end },
    },
    select: { id: true, numero: true, iniciadaEn: true, cerradaEn: true, activa: true },
  });

  return NextResponse.json({
    period,
    totalVentas,
    totalEfectivoRecibido,
    totalTransferenciaRecibida,
    totalRecibido,
    totalPorCobrar,
    totalLitros,
    totalGastos,
    utilidadBruta: totalVentas - totalGastos,
    cantidadEntregas,
    cantidadVueltas: vueltas.length,
    gastosPorTipo,
    vueltas: vueltas.map(v => ({
      id: v.id,
      numero: v.numero,
      iniciadaEn: v.iniciadaEn,
      cerradaEn: v.cerradaEn,
      activa: v.activa,
    })),
  });
}
