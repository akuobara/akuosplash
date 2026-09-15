import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/liquidacion/cobrar-saldo
// Permite al chofer cobrarse el saldo pendiente (de liquidación anterior) con el efectivo que tiene en mano.
// Registra un pago en la DB para que aparezca en el resumen del día y en la liquidación.
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const monto = Number(body.monto);

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    // Verificar que hay saldo pendiente
    const config = await db.configuracion.findUnique({ where: { duenoId } });
    const saldoPendiente = config?.saldoPendienteLiquidacion || 0;

    if (saldoPendiente <= 0) {
      return NextResponse.json({ error: "No tenés saldo a favor para cobrar" }, { status: 400 });
    }

    if (monto > saldoPendiente) {
      return NextResponse.json({ error: `El monto no puede ser mayor al saldo pendiente (${saldoPendiente})` }, { status: 400 });
    }

    // Registrar el pago: el chofer se cobra con efectivo
    const pago = await db.pago.create({
      data: {
        fecha: new Date(),
        clienteId: null,
        monto,
        metodoPago: "efectivo",
        descripcion: `Cobro de saldo de liquidación anterior`,
        nota: `El chofer se cobró ${monto} del saldo pendiente con efectivo en mano`,
        choferId: session.userId,
        duenoId,
      },
    });

    // Reducir el saldo pendiente
    const nuevoSaldo = saldoPendiente - monto;
    await db.configuracion.update({
      where: { duenoId },
      data: { saldoPendienteLiquidacion: nuevoSaldo },
    });

    return NextResponse.json({
      ok: true,
      pago,
      saldoAnterior: saldoPendiente,
      saldoNuevo: nuevoSaldo,
      message: `Cobraste ${monto} con efectivo. Saldo pendiente restante: ${nuevoSaldo}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
