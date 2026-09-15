import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/liquidacion/pagar-saldo
// Cobra el saldo pendiente de liquidación anterior.
// metodo: "efectivo" (chofer se cobra con efectivo en mano) o "transferencia" (admin transfirió)
//
// IMPORTANTE: NO se crea ningún gasto ni pago en la DB.
// Solo se setea saldoPendienteLiquidacion = 0.
//
// Razón: el saldo ya está representado por la línea "+ Saldo del período anterior"
// en la liquidación. Crear un gasto adicional:
//   1. Aparece en la lista de gastos (confuso para el usuario)
//   2. Reduce la utilidad bruta → reduce el pago al chofer (doble conteo)
//   3. Suma una entrada fantasma que el admin no puede borrar fácilmente
//
// El cobro queda implícito: el saldo pasa de $76.100 → $0 y desaparece la línea.
// Si se necesita auditoría, se puede consultar el cierre del período anterior.
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
      return NextResponse.json(
        { error: `El monto no puede ser mayor al saldo pendiente (${saldoPendiente})` },
        { status: 400 }
      );
    }

    // Solo actualizar el saldo pendiente. NO crear gasto ni pago.
    const nuevoSaldo = saldoPendiente - monto;
    await db.configuracion.update({
      where: { duenoId },
      data: { saldoPendienteLiquidacion: nuevoSaldo },
    });

    return NextResponse.json({
      ok: true,
      metodo,
      monto,
      saldoAnterior: saldoPendiente,
      saldoNuevo: nuevoSaldo,
      message:
        metodo === "transferencia"
          ? `Transferencia registrada. Saldo restante: $${nuevoSaldo.toLocaleString("es-CL")}`
          : `Cobro con efectivo registrado. Saldo restante: $${nuevoSaldo.toLocaleString("es-CL")}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
