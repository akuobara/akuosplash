import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/liquidacion/pagar-saldo
// Registra un pago del saldo pendiente de liquidación anterior.
// metodo: "efectivo" (chofer se cobra con efectivo en mano) o "transferencia" (admin transfirió)
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const monto = Number(body.monto);
    const metodo = body.metodo || "efectivo"; // efectivo | transferencia

    if (!monto || monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    const config = await db.configuracion.findUnique({ where: { duenoId } });
    const saldoPendiente = config?.saldoPendienteLiquidacion || 0;

    if (saldoPendiente <= 0) {
      return NextResponse.json({ error: "No hay saldo pendiente para cobrar/pagar" }, { status: 400 });
    }

    if (monto > saldoPendiente) {
      return NextResponse.json({ error: `El monto no puede ser mayor al saldo pendiente (${saldoPendiente})` }, { status: 400 });
    }

    // Registrar como GASTO del dueño (no como pago recibido)
    // porque el dueño le está pagando al chofer — es un egreso, no un ingreso.
    const descripcion = metodo === "transferencia"
      ? "Pago de saldo de liquidación anterior por transferencia"
      : "Pago de saldo de liquidación anterior con efectivo";

    const gasto = await db.gasto.create({
      data: {
        fecha: new Date(),
        tipo: "otro",
        descripcion,
        monto,
        pagadoPor: "dueno", // el dueño es quien paga
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
      gasto,
      saldoAnterior: saldoPendiente,
      saldoNuevo: nuevoSaldo,
      message: `${metodo === "transferencia" ? "Transferencia registrada" : "Pago con efectivo registrado"}. Saldo restante: ${nuevoSaldo}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
