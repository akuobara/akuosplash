import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/restaurar-saldo
// Limpia todos los registros fantasma de cobro de saldo y restaura el saldo pendiente.
//
// Busca gastos y pagos con descripciones que contengan cualquiera de:
//   - "saldo"
//   - "liquidación" o "liquidacion"
//   - "anterior"
//   - "cobro de"
//
// Esto es más robusto que el filtro anterior ("saldo de liquidación") que fallaba
// cuando el description tenía una variación (mayúsculas, sin acento, etc.).
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Filtro amplio: cualquier descripción que mencione saldo/liquidación/anterior/cobro
    const filtroDescripcion = {
      OR: [
        { contains: "saldo" },
        { contains: "Saldo" },
        { contains: "SALDO" },
        { contains: "liquidación" },
        { contains: "liquidacion" },
        { contains: "Liquidación" },
        { contains: "Liquidacion" },
        { contains: "anterior" },
        { contains: "Anterior" },
        { contains: "cobro de saldo" },
        { contains: "pago de saldo" },
        { contains: "Cobro de saldo" },
        { contains: "Pago de saldo" },
      ],
    };

    const gastos = await db.gasto.findMany({
      where: { duenoId, descripcion: filtroDescripcion },
      select: { id: true, monto: true, descripcion: true, fecha: true },
    });
    for (const g of gastos) {
      await db.gasto.delete({ where: { id: g.id } });
    }

    const pagos = await db.pago.findMany({
      where: { duenoId, descripcion: filtroDescripcion },
      select: { id: true, monto: true, descripcion: true, fecha: true },
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
      detalleGastos: gastos,
      detallePagos: pagos,
      saldoRestaurado: config.saldoPendienteLiquidacion,
      message: `Limpieza completa. ${gastos.length} gastos y ${pagos.length} pagos eliminados. Saldo restaurado a $76.100.`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
