import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/restaurar-saldo
// Limpia todos los registros fantasma de cobro de saldo y restaura el saldo pendiente.
//
// ESTRATEGIA ROBUSTA: NO dependemos del texto de la descripcion (que varía entre
// mayúsculas, acentos, "pago en efectivo", "cobro de saldo", etc.). En vez de eso
// borramos por patrón:
//   - Gastos del último mes con pagadoPor="dueno" y tipo="otro" (cobros fantasma)
//   - Pagos del último mes con descripcion que contenga saldo/liquidacion/anterior
// Esto atrapa TODAS las variantes sin importar cómo estén escritos.
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const haceUnMes = new Date();
    haceUnMes.setDate(haceUnMes.getDate() - 30);

    // 1. Borrar TODOS los gastos del último mes que sean pagadoPor="dueno" + tipo="otro"
    //    Ese es el patrón exacto de los cobros fantasma. No hay otros gastos legitimos
    //    que tengan ese patron (los gastos reales son combustible, peaje, etc. con tipo especifico
    //    o pagadosPor="chofer").
    const gastos = await db.gasto.findMany({
      where: {
        duenoId,
        fecha: { gte: haceUnMes },
        pagadoPor: "dueno",
        tipo: "otro",
      },
      select: { id: true, monto: true, descripcion: true, fecha: true },
    });
    for (const g of gastos) {
      await db.gasto.delete({ where: { id: g.id } });
    }

    // 2. Borrar pagos con descripcion que mencione saldo/liquidacion/anterior
    //    (variantes en cualquier casing)
    const terminosPago = [
      "saldo", "Saldo", "SALDO",
      "liquidación", "liquidacion", "Liquidación", "Liquidacion",
      "anterior", "Anterior",
    ];
    const pagos = await db.pago.findMany({
      where: {
        duenoId,
        fecha: { gte: haceUnMes },
        OR: terminosPago.map((t) => ({ descripcion: { contains: t } })),
      },
      select: { id: true, monto: true, descripcion: true, fecha: true },
    });
    for (const p of pagos) {
      await db.pago.delete({ where: { id: p.id } });
    }

    // 3. Restaurar el saldo pendiente a 76100
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
      message: `Limpieza completa. ${gastos.length} gastos fantasma y ${pagos.length} pagos eliminados. Saldo restaurado a $76.100.`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
