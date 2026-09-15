import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Eliminar los gastos incorrectos del cobro anterior
    const gastos = await db.gasto.findMany({
      where: { duenoId, descripcion: { contains: "saldo de liquidación anterior" } },
      select: { id: true, monto: true },
    });

    for (const g of gastos) {
      await db.gasto.delete({ where: { id: g.id } });
    }

    // Restaurar el saldo pendiente a 76100
    const config = await db.configuracion.update({
      where: { duenoId },
      data: { saldoPendienteLiquidacion: 76100 },
    });

    return NextResponse.json({
      ok: true,
      gastosEliminados: gastos.length,
      saldoRestaurado: config.saldoPendienteLiquidacion,
      message: "Saldo restaurado a 76100. Gastos incorrectos eliminados. Ahora podés cobrar con efectivo correctamente.",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
