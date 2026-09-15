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
// Sintaxis Prisma correcta: el OR va al nivel del `where`, no dentro del campo descripcion.
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Genera las variantes de case para cada término clave.
    // Se usan múltiples OR porque SQLite (Turso) no soporta mode: "insensitive".
    const terminos = [
      "saldo",
      "Saldo",
      "SALDO",
      "liquidación",
      "liquidacion",
      "Liquidación",
      "Liquidacion",
      "anterior",
      "Anterior",
      "cobro de saldo",
      "pago de saldo",
      "Cobro de saldo",
      "Pago de saldo",
    ];

    // Filtro WHERE (duenoId = X) AND (descripcion LIKE '%saldo%' OR descripcion LIKE '%Saldo%' OR ...)
    const whereGasto = {
      duenoId,
      OR: terminos.map((t) => ({ descripcion: { contains: t } })),
    };
    const wherePago = {
      duenoId,
      OR: terminos.map((t) => ({ descripcion: { contains: t } })),
    };

    const gastos = await db.gasto.findMany({
      where: whereGasto,
      select: { id: true, monto: true, descripcion: true, fecha: true },
    });
    for (const g of gastos) {
      await db.gasto.delete({ where: { id: g.id } });
    }

    const pagos = await db.pago.findMany({
      where: wherePago,
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
      detalleGastos: gastos.map((g) => ({ id: g.id, monto: g.monto, descripcion: g.descripcion, fecha: g.fecha })),
      detallePagos: pagos.map((p) => ({ id: p.id, monto: p.monto, descripcion: p.descripcion, fecha: p.fecha })),
      saldoRestaurado: config.saldoPendienteLiquidacion,
      message: `Limpieza completa. ${gastos.length} gastos y ${pagos.length} pagos eliminados. Saldo restaurado a $76.100.`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
