import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/liquidacion/periodo?offset=0
// Devuelve datos de liquidación con la estructura que espera el LiquidacionTab de Aljibe:
// { periodo: { label, cerrado }, resumen: { ... }, config: { ... } }
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const offset = Number(searchParams.get("offset") || 0);

  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  fin.setHours(23, 59, 59, 999);

  const [entregas, gastos, vueltas] = await Promise.all([
    akuosplashDb.akuoEntrega.findMany({
      where: { transportistaId: user.id, creadoEn: { gte: inicio, lte: fin } },
      select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true, montoRecibido: true, estadoPago: true, descuento: true },
    }),
    akuosplashDb.akuoGasto.findMany({
      where: { transportistaId: user.id, fecha: { gte: inicio, lte: fin } },
      select: { monto: true, tipo: true },
    }),
    akuosplashDb.akuoVuelta.findMany({
      where: { transportistaId: user.id, iniciadaEn: { gte: inicio, lte: fin } },
      select: { id: true, numero: true, iniciadaEn: true, cerradaEn: true, validadaManualmente: true },
    }),
  ]);

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalEfectivo = entregas.reduce((s, e) => s + (e.montoEfectivo || 0), 0);
  const totalTransferencia = entregas.reduce((s, e) => s + (e.montoTransferencia || 0), 0);
  const totalRecibido = entregas.reduce((s, e) => s + (e.montoRecibido || 0), 0);
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const saldoPeriodo = totalVentas - totalRecibido;
  const utilidad = totalVentas - totalGastos;

  const vueltasCompletadas = vueltas.filter(v => v.cerradaEn !== null).length;
  const vueltasTotal = vueltas.length;

  // Pago al chofer (50% de utilidad en modo porcentaje)
  const porcentajeChofer = 50;
  const pagoChofer = Math.round(utilidad * porcentajeChofer / 100);
  const gastosChofer = Math.round(totalGastos * porcentajeChofer / 100);
  const gastosDueno = totalGastos - gastosChofer;
  const saldoChofer = pagoChofer - gastosChofer;

  return NextResponse.json({
    periodo: {
      inicio: inicio.toISOString(),
      fin: fin.toISOString(),
      label: inicio.toLocaleDateString("es-CL", { month: "long", year: "numeric" }),
      cerrado: false,
      offset,
    },
    resumen: {
      totalVentas,
      totalEfectivoRecibido: totalEfectivo,
      totalTransferenciaRecibida: totalTransferencia,
      totalRecibido,
      totalLitros,
      totalGastos,
      utilidadBruta: utilidad,
      saldoPeriodo,
      saldoArrastrado: 0,
      saldoCobrado: 0,
      cantidadEntregas: entregas.length,
      gastosChofer,
      gastosDueno,
      vueltasCompletadas,
      vueltasTotal,
      vueltasUnicoCliente: 0,
      vueltasMultiple: vueltasCompletadas,
      pagoChofer,
      saldoChofer,
      cantidadVueltas: vueltas.length,
    },
    config: {
      nombreChofer: user.nombre,
      nombreDueno: user.nombre,
      modoLiquidacion: "porcentaje",
      porcentajeComisionChofer: porcentajeChofer,
      porcentajeComisionDueno: 100 - porcentajeChofer,
      montoPorVueltaUnicoCliente: 0,
      montoPorVueltaMultiple: 0,
      capacidadCamion: (user as any).capacidadVehiculoKg || 5000,
      periodoLiquidacion: "mensual",
    },
    vueltas: vueltas.map(v => ({ id: v.id, numero: v.numero, iniciadaEn: v.iniciadaEn, cerradaEn: v.cerradaEn })),
  });
}
