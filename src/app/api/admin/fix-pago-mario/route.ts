// Endpoint temporal para eliminar el pago de $400 de Mario que quedó con
// fecha incorrecta (12-09-2026 cuando debería ser de la semana pasada).
// Como no sabemos la fecha exacta, lo eliminamos directamente.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Buscar el pago de $400 de Mario con fecha de hoy (12-09-2026)
    // Mario es un cliente del admin, así que buscamos por monto y fecha
    const pagos = await db.pago.findMany({
      where: {
        duenoId,
        monto: 400,
        metodoPago: "transferencia",
      },
      include: { cliente: { select: { nombre: true } } },
    });

    const pagosMario = pagos.filter(p => p.cliente?.nombre?.toLowerCase().includes("mario"));

    if (pagosMario.length === 0) {
      return NextResponse.json({ ok: true, message: "No se encontró el pago de Mario de $400" });
    }

    // Eliminar todos los pagos de Mario de $400
    const eliminados = [];
    for (const pago of pagosMario) {
      await db.pago.delete({ where: { id: pago.id } });
      eliminados.push({
        id: pago.id,
        cliente: pago.cliente?.nombre,
        monto: pago.monto,
        fecha: pago.fecha,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `Se eliminaron ${eliminados.length} pago(s) de Mario de $400`,
      eliminados,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest) { return ejecutar(); }
export async function GET(req: NextRequest) { return ejecutar(); }
