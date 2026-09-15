import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/liquidacion/pagar-saldo
// Registra el cobro del saldo pendiente de liquidación anterior.
// metodo: "efectivo" (chofer se cobra con efectivo en mano) o "transferencia"
//
// CÓMO FUNCIONA (vs. versiones anteriores que rompían la liquidación):
// 1. NO modifica saldoPendienteLiquidacion (se resetea solo al cerrar el período)
// 2. Crea un registro de PAGO con descripcion "Cobro de saldo anterior..."
//    El endpoint /api/liquidacion/periodo EXCLUYE estos pagos del cálculo de
//    efectivoTotal, así que no afectan "Debés entregar".
// 3. Marca saldoCobrado=true para ocultar el botón "Cobrar saldo anterior"
//    hasta que se cierre el período.
//
// Esto significa que al cobrar:
//   - "Debés entregar" NO CAMBIA (el saldo arrastrado sigue sumando)
//   - El botón desaparece (ya cobraste)
//   - Se muestra "✓ Cobrado" en la línea del saldo anterior
//   - Al cerrar el período, saldoPendienteLiquidacion se resetea correctamente
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

    // Crear un PAGO (no gasto) con descripcion especial
    // El endpoint /api/liquidacion/periodo reconoce esta descripcion y:
    //   - NO lo incluye en efectivoTotal (no afecta "Debés entregar")
    //   - Lo muestra como "✓ Cobrado" en la línea de saldo anterior
    const descripcion = metodo === "transferencia"
      ? "Cobro de saldo anterior por transferencia"
      : "Cobro de saldo anterior en efectivo";

    const pago = await db.pago.create({
      data: {
        fecha: new Date(),
        monto,
        metodoPago: metodo,
        descripcion,
        clienteId: null, // no es de un cliente, es del saldo anterior
        choferId: session.userId,
        duenoId,
      },
    });

    // Marcar el pago como cobro de saldo anterior vía raw SQL (no depende del
    // schema de Prisma — la columna es agregada por /api/admin/migrate-saldo-cobro).
    // Si la migración todavía no se corrió, este UPDATE falla silenciosamente y
    // el filtro por texto en /api/liquidacion/periodo hace el trabajo.
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1 WHERE "id" = ?;`,
        pago.id
      );
    } catch {
      // Columna no existe todavía — no es crítico, el texto del descripcion
      // también matchea el filtro en /api/liquidacion/periodo.
    }

    // NO modificar saldoPendienteLiquidacion aquí.
    // Se resetea cuando se cierra el período en /api/liquidacion/cerrar

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
