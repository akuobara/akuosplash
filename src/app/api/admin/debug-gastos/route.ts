import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-gastos
// Lista TODOS los gastos del último mes para diagnóstico.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const haceUnMes = new Date();
  haceUnMes.setDate(haceUnMes.getDate() - 30);

  const [gastos, pagos, config] = await Promise.all([
    db.gasto.findMany({
      where: { duenoId, fecha: { gte: haceUnMes } },
      select: { id: true, monto: true, descripcion: true, fecha: true, tipo: true, pagadoPor: true, choferId: true },
      orderBy: { fecha: "desc" },
    }),
    db.pago.findMany({
      where: { duenoId, fecha: { gte: haceUnMes } },
      select: { id: true, monto: true, descripcion: true, fecha: true, metodoPago: true, clienteId: true },
      orderBy: { fecha: "desc" },
    }),
    db.configuracion.findUnique({
      where: { duenoId },
      select: { saldoPendienteLiquidacion: true },
    }),
  ]);

  return NextResponse.json({
    saldoPendienteLiquidacion: config?.saldoPendienteLiquidacion ?? 0,
    totalGastosUltimoMes: gastos.length,
    totalPagosUltimoMes: pagos.length,
    gastos,
    pagos,
  });
}
