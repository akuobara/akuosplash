import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/restaurar-saldo
//
// Limpia TODOS los cobros fantasma de saldo anterior (pagos Y gastos)
// y restaura el saldo pendiente a $76.100.
//
// Estrategia: combina 3 fuentes para borrar todo rastro:
//   1. Pagos con esCobroSaldoAnterior=1 (si la columna existe)
//   2. Pagos con descripcion que mencione saldo/liquidacion/anterior
//   3. Gastos del último mes con descripcion que mencione saldo/liquidacion/anterior
//      o pagadoPor=dueno + tipo=otro (cobros fantasma de versiones previas)
//   4. Pagos sin descripcion pero con clienteId=null y monto=saldoPendiente
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const haceUnAno = new Date();
    haceUnAno.setDate(haceUnAno.getDate() - 365);

    const config = await db.configuracion.findUnique({
      where: { duenoId },
      select: { saldoPendienteLiquidacion: true },
    });
    const saldoPendiente = config?.saldoPendienteLiquidacion || 0;

    // === 1. BORRAR PAGOS ===
    // Combinar: pagos marcados con esCobroSaldoAnterior=1 (raw SQL si columna existe)
    //           + pagos con descripcion que matchee texto + pagos sin descripcion con clienteId=null
    let pagosBorrados: Array<{ id: string; monto: number; descripcion: string | null; fecha: string }> = [];

    // 1a. Por columna esCobroSaldoAnterior=1 (raw SQL)
    try {
      const pagosFlagged: Array<{ id: string; monto: number; descripcion: string | null; fecha: string }> =
        await db.$queryRawUnsafe(
          `SELECT "id", "monto", "descripcion", "fecha" FROM "Pago"
           WHERE "duenoId" = ? AND "esCobroSaldoAnterior" = 1;`,
          duenoId
        );
      pagosBorrados.push(...pagosFlagged);
    } catch {
      // Columna no existe, salteamos
    }

    // 1b. Por texto de descripcion
    const terminos = [
      "saldo", "Saldo", "SALDO",
      "liquidación", "liquidacion", "Liquidación", "Liquidacion",
      "anterior", "Anterior",
      "cobro", "Cobro",
    ];
    const pagosTexto = await db.pago.findMany({
      where: {
        duenoId,
        fecha: { gte: haceUnAno },
        OR: terminos.map((t) => ({ descripcion: { contains: t } })),
      },
      select: { id: true, monto: true, descripcion: true, fecha: true },
    });
    // Agregar los que no estén ya en pagosBorrados (fecha es Date, convertir a string)
    for (const p of pagosTexto) {
      if (!pagosBorrados.some((pb) => pb.id === p.id)) {
        pagosBorrados.push({ id: p.id, monto: p.monto, descripcion: p.descripcion, fecha: String(p.fecha) });
      }
    }

    // 1c. Por patrón estructural: sin descripcion + clienteId=null + monto=saldoPendiente
    if (saldoPendiente > 0) {
      const pagosEstructurales = await db.pago.findMany({
        where: {
          duenoId,
          fecha: { gte: haceUnAno },
          descripcion: null,
          clienteId: null,
          monto: saldoPendiente,
        },
        select: { id: true, monto: true, descripcion: true, fecha: true },
      });
      for (const p of pagosEstructurales) {
        if (!pagosBorrados.some((pb) => pb.id === p.id)) {
          pagosBorrados.push({ id: p.id, monto: p.monto, descripcion: p.descripcion, fecha: String(p.fecha) });
        }
      }
    }

    // Borrar pagos
    for (const p of pagosBorrados) {
      try {
        await db.pago.delete({ where: { id: p.id } });
      } catch {
        // Ya fue borrado
      }
    }

    // === 2. BORRAR GASTOS FANTASMA ===
    // (de intentos previos cuando pagar-saldo creaba GASTO en vez de PAGO)
    const gastos = await db.gasto.findMany({
      where: {
        duenoId,
        fecha: { gte: haceUnAno },
        OR: [
          { monto: 76100 },
          { monto: saldoPendiente, descripcion: null },
          ...terminos.map((t) => ({ descripcion: { contains: t } })),
          { pagadoPor: "dueno", tipo: "otro" },
        ],
      },
      select: { id: true, monto: true, descripcion: true, fecha: true, tipo: true, pagadoPor: true },
    });
    for (const g of gastos) {
      try {
        await db.gasto.delete({ where: { id: g.id } });
      } catch {
        // Ya fue borrado
      }
    }

    // === 3. RESTAURAR SALDO ===
    const configUpdate = await db.configuracion.update({
      where: { duenoId },
      data: { saldoPendienteLiquidacion: 76100 },
    });

    return NextResponse.json({
      ok: true,
      pagosEliminados: pagosBorrados.length,
      gastosEliminados: gastos.length,
      detallePagos: pagosBorrados.map((p) => ({
        id: p.id,
        monto: p.monto,
        descripcion: p.descripcion,
        fecha: String(p.fecha),
      })),
      detalleGastos: gastos.map((g) => ({
        id: g.id,
        monto: g.monto,
        descripcion: g.descripcion,
        tipo: g.tipo,
        pagadoPor: g.pagadoPor,
        fecha: String(g.fecha),
      })),
      saldoRestaurado: configUpdate.saldoPendienteLiquidacion,
      message: `Limpieza completa. ${pagosBorrados.length} pagos y ${gastos.length} gastos fantasma eliminados. Saldo restaurado a $76.100.`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
