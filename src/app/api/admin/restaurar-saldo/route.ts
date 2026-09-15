import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Eliminar TODOS los gastos y pagos con "saldo de liquidación anterior"
    const gastos = await db.gasto.findMany({
      where: { duenoId, descripcion: { contains: "saldo de liquidación" } },
      select: { id: true, monto: true, descripcion: true },
    });
    for (const g of gastos) {
      await db.gasto.delete({ where: { id: g.id } });
    }

    const pagos = await db.pago.findMany({
      where: { duenoId, descripcion: { contains: "saldo de liquidación" } },
      select: { id: true, monto: true, descripcion: true },
    });
    for (const p of pagos) {
      await db.pago.delete({ where: { id: p.id } });
    }

    // Restaurar el saldo pendiente a 76100
    const config = await db.configuracion.update({
      where: { duenoId },
      data: { saldoPendienteLiquidacion: 76100 },
    });

    return NextResponse.json({
      ok: true,
      gastosEliminados: gastos.length,
      pagosEliminados: pagos.length,
      saldoRestaurado: config.saldoPendienteLiquidacion,
      message: "Limpio. Saldo restaurado a 76100. Todos los cobros anteriores eliminados.",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
