import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/liquidacion/pagar-saldo
// Registra el cobro del saldo pendiente de liquidación anterior.
// metodo: "efectivo" (chofer se cobra con efectivo en mano) o "transferencia"
//
// CÓMO FUNCIONA:
// 1. Verifica si ya hay un cobro de saldo anterior en el período actual.
//    Si lo hay, rechaza la operación (no se puede cobrar dos veces).
// 2. NO modifica saldoPendienteLiquidacion (se resetea solo al cerrar el período)
// 3. Crea un PAGO con descripcion "Cobro de saldo anterior..." y marca con
//    esCobroSaldoAnterior=1 (si la columna existe en la DB)
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
    const metodo = body.metodo || "efectivo";

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

    // === Calcular período actual (igual que /api/liquidacion/periodo) ===
    const periodo = config?.periodoLiquidacion || "mensual";
    const nowCL = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
    let start: Date;
    let end: Date;
    if (periodo === "semanal") {
      const today = new Date(nowCL.getFullYear(), nowCL.getMonth(), nowCL.getDate());
      const todayDow = today.getDay();
      const startCurrent = new Date(today);
      startCurrent.setDate(today.getDate() - todayDow);
      start = new Date(Date.UTC(startCurrent.getFullYear(), startCurrent.getMonth(), startCurrent.getDate(), 4, 0, 0));
      const endCierreCL = new Date(startCurrent);
      endCierreCL.setDate(startCurrent.getDate() + 6);
      end = new Date(Date.UTC(endCierreCL.getFullYear(), endCierreCL.getMonth(), endCierreCL.getDate() + 1, 4, 0, 0));
    } else {
      start = new Date(Date.UTC(nowCL.getFullYear(), nowCL.getMonth(), 1, 4, 0, 0));
      end = new Date(Date.UTC(nowCL.getFullYear(), nowCL.getMonth() + 1, 1, 4, 0, 0));
    }

    // === Verificar si ya hay un cobro de saldo anterior este período ===
    // Estrategia múltiple para detectar el cobro aunque sea de versiones viejas:
    //   1. Pagos con esCobroSaldoAnterior=1 (si la columna existe)
    //   2. Pagos con descripcion que mencione saldo/liquidacion/anterior/cobro
    //   3. Pagos sin descripcion + clienteId=null + monto=saldoPendiente
    //   4. Gastos con patron similar (de intentos previos cuando crear gasto en vez de pago)

    // 1. Por columna esCobroSaldoAnterior (raw SQL)
    let yaCobrado = false;
    try {
      const flagged: Array<{ id: string }> = await db.$queryRawUnsafe(
        `SELECT "id" FROM "Pago"
         WHERE "duenoId" = ? AND "esCobroSaldoAnterior" = 1
         AND "fecha" >= ? AND "fecha" < ?;`,
        duenoId,
        start.toISOString(),
        end.toISOString()
      );
      if (flagged.length > 0) yaCobrado = true;
    } catch {
      // Columna no existe todavía
    }

    // 2 y 3. Por texto y patrón estructural (Prisma)
    if (!yaCobrado) {
      const terminos = [
        "saldo", "Saldo", "SALDO",
        "liquidación", "liquidacion", "Liquidación", "Liquidacion",
        "anterior", "Anterior",
        "cobro", "Cobro",
      ];
      const existentes = await db.pago.findMany({
        where: {
          duenoId,
          fecha: { gte: start, lt: end },
          OR: [
            ...terminos.map((t) => ({ descripcion: { contains: t } })),
            // Patrón estructural: sin descripcion + clienteId=null + monto=saldoPendiente
            { descripcion: null, clienteId: null, monto: saldoPendiente },
          ],
        },
        select: { id: true, monto: true, descripcion: true },
      });
      if (existentes.length > 0) yaCobrado = true;
    }

    // 4. Por gastos fantasma (de versiones viejas que creaban GASTO)
    if (!yaCobrado) {
      const gastos = await db.gasto.findMany({
        where: {
          duenoId,
          fecha: { gte: start, lt: end },
          OR: [
            { monto: saldoPendiente, descripcion: null },
            { monto: 76100 },
            { pagadoPor: "dueno", tipo: "otro" },
            { descripcion: { contains: "saldo" } },
            { descripcion: { contains: "Saldo" } },
            { descripcion: { contains: "anterior" } },
            { descripcion: { contains: "liquidación" } },
            { descripcion: { contains: "liquidacion" } },
          ],
        },
        select: { id: true },
      });
      if (gastos.length > 0) yaCobrado = true;
    }

    if (yaCobrado) {
      return NextResponse.json(
        {
          error: "Ya cobraste el saldo anterior este período. Cerrá el período para habilitar el cobro del próximo.",
          yaCobrado: true,
        },
        { status: 400 }
      );
    }

    // === Crear el pago ===
    const descripcion = metodo === "transferencia"
      ? "Cobro de saldo anterior por transferencia"
      : "Cobro de saldo anterior en efectivo";

    const pago = await db.pago.create({
      data: {
        fecha: new Date(),
        monto,
        metodoPago: metodo,
        descripcion,
        clienteId: null,
        choferId: session.userId,
        duenoId,
      },
    });

    // Marcar con esCobroSaldoAnterior=1 (raw SQL, si columna existe)
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1 WHERE "id" = ?;`,
        pago.id
      );
    } catch {
      // Columna no existe — no crítico, el filtro por texto también funciona
    }

    return NextResponse.json({
      ok: true,
      pago,
      monto,
      metodo,
      saldoPendiente,
      message: `${metodo === "transferencia" ? "Transferencia registrada" : "Cobro con efectivo registrado"} por $${monto.toLocaleString("es-CL")}. El saldo se asentará al cerrar el período.`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
