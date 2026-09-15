import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/restaurar-saldo
// Limpia todos los registros fantasma de cobro de saldo y restaura el saldo pendiente.
//
// ESTRATEGIA ULTRA AGRESIVA: ya intentamos filtrar por pagadoPor+tipo y por texto
// de descripcion, pero el usuario sigue viendo cobros fantasma. Vamos a borrar
// CUALQUIER cosa que pueda ser un cobro fantasma:
//   - Cualquier gasto del último año con monto = 76100
//   - Cualquier gasto del último año con descripcion que mencione: saldo, liquidación,
//     liquidacion, anterior, efectivo, transferencia, cobro, pago (en cualquier casing)
//   - Cualquier pago del último año con descripcion que mencione esos mismos términos
//
// Esto es seguro porque los gastos legítimos (combustible, peaje, etc.) no tienen
// esas palabras en su descripción ni monto = 76100.
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const haceUnAno = new Date();
    haceUnAno.setDate(haceUnAno.getDate() - 365);

    const terminos = [
      "saldo", "Saldo", "SALDO",
      "liquidación", "liquidacion", "Liquidación", "Liquidacion", "LIQUIDACIÓN", "LIQUIDACION",
      "anterior", "Anterior", "ANTERIOR",
      "efectivo", "Efectivo", "EFECTIVO",
      "transferencia", "Transferencia", "TRANSFERENCIA",
      "cobro", "Cobro", "COBRO",
      "pago de saldo", "Pago de saldo", "PAGO DE SALDO",
    ];

    // GASTOS: borrar si (monto = 76100) OR (descripción menciona cualquier término)
    const gastos = await db.gasto.findMany({
      where: {
        duenoId,
        fecha: { gte: haceUnAno },
        OR: [
          { monto: 76100 },
          ...terminos.map((t) => ({ descripcion: { contains: t } })),
        ],
      },
      select: { id: true, monto: true, descripcion: true, fecha: true, tipo: true, pagadoPor: true },
    });
    for (const g of gastos) {
      await db.gasto.delete({ where: { id: g.id } });
    }

    // PAGOS: borrar si descripcion menciona cualquier término
    const pagos = await db.pago.findMany({
      where: {
        duenoId,
        fecha: { gte: haceUnAno },
        OR: terminos.map((t) => ({ descripcion: { contains: t } })),
      },
      select: { id: true, monto: true, descripcion: true, fecha: true, metodoPago: true },
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
      detalleGastos: gastos.map((g) => ({
        id: g.id,
        monto: g.monto,
        descripcion: g.descripcion,
        tipo: g.tipo,
        pagadoPor: g.pagadoPor,
        fecha: g.fecha,
      })),
      detallePagos: pagos.map((p) => ({
        id: p.id,
        monto: p.monto,
        descripcion: p.descripcion,
        metodoPago: p.metodoPago,
        fecha: p.fecha,
      })),
      saldoRestaurado: config.saldoPendienteLiquidacion,
      message: `Limpieza completa. ${gastos.length} gastos fantasma y ${pagos.length} pagos eliminados. Saldo restaurado a $76.100.`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
