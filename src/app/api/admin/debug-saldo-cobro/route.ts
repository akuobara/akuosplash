import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-saldo-cobro
// Diagnóstico completo del bug "saldo cobrado no se detecta".
//
// Ejecuta la MISMA lógica que /api/liquidacion/periodo pero con MUCHO más logging:
//   - Lista TODOS los pagos del último año con su descripcion, monto, fecha,
//     clienteId, choferId
//   - Para cada pago, evalúa el filtro `esCobroSaldoAnterior(descripcion)` y
//     muestra el resultado
//   - Verifica si la columna `esCobroSaldoAnterior` existe en la DB (vía PRAGMA)
//   - Lista TODOS los pagos marcados con esCobroSaldoAnterior=1 (si la columna existe)
//   - Lista TODOS los gastos del último año y los evalúa contra el mismo filtro
//   - Muestra el saldoPendienteLiquidacion actual de la configuración
//
// Útil para diagnosticar por qué el usuario ve AMBOS el botón "Cobrar saldo anterior"
// Y el cobro fantasma en la lista de pagos/gastos.
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const haceUnAno = new Date();
  haceUnAno.setDate(haceUnAno.getDate() - 365);

  // Filtro de texto (mismo que /api/liquidacion/periodo)
  const esCobroSaldoAnterior = (descripcion: string | null) => {
    if (!descripcion) return false;
    const d = descripcion.toLowerCase();
    return (
      d.includes("cobro de saldo anterior") ||
      d.includes("pago de saldo") ||
      (d.includes("saldo") && (d.includes("anterior") || d.includes("liquidación") || d.includes("liquidacion")))
    );
  };

  // 1) Verificar si la columna esCobroSaldoAnterior existe
  let columnaExiste = false;
  let columnaError: string | null = null;
  try {
    const cols: Array<{ name: string }> = await db.$queryRawUnsafe(`PRAGMA table_info("Pago");`);
    columnaExiste = cols.some((c) => c.name === "esCobroSaldoAnterior");
  } catch (e) {
    columnaError = e instanceof Error ? e.message : String(e);
  }

  // 2) Listar todos los pagos del último año
  const pagos = await db.pago.findMany({
    where: { duenoId, fecha: { gte: haceUnAno } },
    select: {
      id: true,
      monto: true,
      descripcion: true,
      fecha: true,
      metodoPago: true,
      clienteId: true,
      choferId: true,
    },
    orderBy: { fecha: "desc" },
  });

  // 3) Listar pagos marcados con esCobroSaldoAnterior=1 (raw SQL, si la columna existe)
  let pagosFlagged: Array<{ id: string; monto: number; descripcion: string | null; fecha: string }> = [];
  let flaggedError: string | null = null;
  if (columnaExiste) {
    try {
      pagosFlagged = await db.$queryRawUnsafe(
        `SELECT "id", "monto", "descripcion", "fecha" FROM "Pago"
         WHERE "esCobroSaldoAnterior" = 1 AND "duenoId" = ?;`,
        duenoId
      );
    } catch (e) {
      flaggedError = e instanceof Error ? e.message : String(e);
    }
  }

  // 4) Listar todos los gastos del último año
  const gastos = await db.gasto.findMany({
    where: { duenoId, fecha: { gte: haceUnAno } },
    select: {
      id: true,
      monto: true,
      descripcion: true,
      fecha: true,
      tipo: true,
      pagadoPor: true,
      choferId: true,
    },
    orderBy: { fecha: "desc" },
  });

  // 5) Configuración
  const config = await db.configuracion.findUnique({
    where: { duenoId },
    select: { saldoPendienteLiquidacion: true, periodoLiquidacion: true, diaCierreMes: true, diaCierreSemana: true },
  });

  // 6) Calcular el período actual (igual que /api/liquidacion/periodo)
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

  // 7) Calcular saldoCobrado para el período actual (mismo cálculo que el endpoint real)
  const pagosPeriodo = pagos.filter((p) => {
    const f = new Date(p.fecha).getTime();
    return f >= start.getTime() && f < end.getTime();
  });
  const cobrosSaldoAnteriorPago = pagosPeriodo.filter((p) => esCobroSaldoAnterior(p.descripcion));
  const cobroSaldoAnteriorTotal = cobrosSaldoAnteriorPago.reduce((s, p) => s + p.monto, 0);

  const gastosPeriodo = gastos.filter((g) => {
    const f = new Date(g.fecha).getTime();
    return f >= start.getTime() && f < end.getTime();
  });
  const saldoArrastradoRaw = config?.saldoPendienteLiquidacion || 0;
  const cobroSaldoAnteriorGastoMonto = gastosPeriodo
    .filter((g) => esCobroSaldoAnterior(g.descripcion) || (saldoArrastradoRaw > 0 && g.monto === saldoArrastradoRaw))
    .reduce((s, g) => s + g.monto, 0);

  const saldoCobrado = cobroSaldoAnteriorTotal > 0 || cobroSaldoAnteriorGastoMonto > 0;

  // 8) Para cada pago del último año, evaluar el filtro
  const pagosConEvaluacion = pagos.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    monto: p.monto,
    metodoPago: p.metodoPago,
    descripcion: p.descripcion,
    clienteId: p.clienteId,
    choferId: p.choferId,
    esCobroSaldoAnterior_texto: esCobroSaldoAnterior(p.descripcion),
    enPeriodoActual: (() => {
      const f = new Date(p.fecha).getTime();
      return f >= start.getTime() && f < end.getTime();
    })(),
    flaggedPorColumna: pagosFlagged.some((pf) => pf.id === p.id),
  }));

  const gastosConEvaluacion = gastos.map((g) => ({
    id: g.id,
    fecha: g.fecha,
    monto: g.monto,
    tipo: g.tipo,
    descripcion: g.descripcion,
    pagadoPor: g.pagadoPor,
    choferId: g.choferId,
    esCobroSaldoAnterior_texto: esCobroSaldoAnterior(g.descripcion),
    montoCoincideSaldo: saldoArrastradoRaw > 0 && g.monto === saldoArrastradoRaw,
    enPeriodoActual: (() => {
      const f = new Date(g.fecha).getTime();
      return f >= start.getTime() && f < end.getTime();
    })(),
  }));

  return NextResponse.json({
    diagnostico: {
      columna_esCobroSaldoAnterior_existe: columnaExiste,
      columna_error: columnaError,
      pagosFlagged_error: flaggedError,
      saldoPendienteLiquidacion: saldoArrastradoRaw,
      periodoLiquidacion: periodo,
      diaCierreMes: config?.diaCierreMes,
      diaCierreSemana: config?.diaCierreSemana,
      periodo_actual_start: start.toISOString(),
      periodo_actual_end: end.toISOString(),
      ahora_chile: nowCL.toISOString(),
    },
    resumen_periodo_actual: {
      totalPagosPeriodo: pagosPeriodo.length,
      cobrosSaldoAnteriorPago_cantidad: cobrosSaldoAnteriorPago.length,
      cobroSaldoAnteriorTotal,
      totalGastosPeriodo: gastosPeriodo.length,
      cobroSaldoAnteriorGastoMonto,
      saldoCobrado_calculado: saldoCobrado,
    },
    pagosFlagged: pagosFlagged.map((p) => ({ ...p, fecha: String(p.fecha) })),
    pagosUltimoAnio: pagosConEvaluacion.map((p) => ({ ...p, fecha: String(p.fecha) })),
    gastosUltimoAnio: gastosConEvaluacion.map((g) => ({ ...g, fecha: String(g.fecha) })),
  });
}
