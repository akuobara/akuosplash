import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";
import { clearCierreCache } from "@/lib/periodo-cerrado";

// Helper para calcular el rango del período
function getPeriodoRange(offsetNum: number, body: any = {}): { start: Date; end: Date } {
  const nowCL = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const periodo = "semanal"; // simplificado — el body no trae el tipo
  if (periodo === "semanal") {
    const today = new Date(nowCL.getFullYear(), nowCL.getMonth(), nowCL.getDate());
    const todayDow = today.getDay();
    const startCurrent = new Date(today);
    startCurrent.setDate(today.getDate() - todayDow + 7 * offsetNum);
    const start = new Date(Date.UTC(startCurrent.getFullYear(), startCurrent.getMonth(), startCurrent.getDate(), 4, 0, 0));
    const endCierreCL = new Date(startCurrent);
    endCierreCL.setDate(startCurrent.getDate() + 6);
    const end = new Date(Date.UTC(endCierreCL.getFullYear(), endCierreCL.getMonth(), endCierreCL.getDate() + 1, 4, 0, 0));
    return { start, end };
  } else {
    const baseMonth = nowCL.getMonth() + offsetNum;
    const baseYear = nowCL.getFullYear();
    const adjustedDate = new Date(baseYear, baseMonth, 1);
    const start = new Date(Date.UTC(adjustedDate.getFullYear(), adjustedDate.getMonth(), 1, 4, 0, 0));
    const end = new Date(Date.UTC(adjustedDate.getFullYear(), adjustedDate.getMonth() + 1, 1, 4, 0, 0));
    return { start, end };
  }
}

// POST /api/liquidacion/cerrar
// Cierra el período actual, registrando la fecha de cierre.
// Solo el dueño puede cerrar períodos.
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Solo el dueño puede cerrar períodos
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo el administrador puede cerrar períodos" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const fechaCierre = body.fechaCierre ? new Date(body.fechaCierre) : new Date();

  // === Calcular el saldo final del período que se cierra ===
  // Buscar el saldo del período actual
  const { start, end } = getPeriodoRange(0, body);
  // (usamos el mismo cálculo que /api/liquidacion/periodo pero simplificado)
  const entregas = await db.entrega.findMany({
    where: { duenoId, fecha: { gte: start, lt: end } },
    select: { total: true, montoEfectivo: true, montoTransferencia: true, descuento: true, descuentoPor: true },
  });
  const gastos = await db.gasto.findMany({
    where: { duenoId, fecha: { gte: start, lt: end } },
    select: { monto: true, pagadoPor: true },
  });
  const pagos = await db.pago.findMany({
    where: { duenoId, fecha: { gte: start, lt: end } },
    select: { monto: true, metodoPago: true, descripcion: true },
  });

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
  const gastosChofer = gastos.filter(g => g.pagadoPor === "chofer").reduce((s, g) => s + g.monto, 0);
  const descuentosChofer = entregas.filter(e => e.descuentoPor === "chofer").reduce((s, e) => s + (e.descuento || 0), 0);
  const totalEfectivoEntregas = entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const pagosSueltosEfectivo = pagos.filter(p => p.metodoPago === "efectivo").reduce((s, p) => s + p.monto, 0);
  const efectivoTotal = totalEfectivoEntregas + pagosSueltosEfectivo;
  const utilidadBruta = totalVentas - totalGastos;

  // Calcular pagoChofer
  let pagoChofer = 0;
  const configActual = await db.configuracion.findUnique({ where: { duenoId } });
  if (configActual?.modoLiquidacion === "vuelta") {
    const vueltas = await db.vuelta.findMany({
      where: { duenoId, OR: [{ activa: false, cerradaEn: { gte: start, lt: end } }, { activa: true, iniciadaEn: { gte: start, lt: end } }] },
      include: { camion: { select: { capacidad: true } }, entregas: { select: { litros: true } } },
    });
    const umbral = configActual?.umbralCompletacionVuelta ?? 0.975;
    for (const v of vueltas) {
      const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
      const cap = v.camion?.capacidad ?? configActual?.capacidadCamion ?? 17000;
      if (litros >= cap * umbral) {
        pagoChofer += v.entregas.length > 1 ? (configActual?.montoPorVueltaMultiple ?? 25000) : (configActual?.montoPorVueltaUnicoCliente ?? 20000);
      }
    }
  } else {
    pagoChofer = (utilidadBruta * (configActual?.porcentajeComisionChofer ?? 50)) / 100;
  }

  const impuesto = configActual?.tipoTributo === "ninguno" ? 0 :
    (Math.max(0, configActual?.aplicaImpuestoSobre === "pago_chofer" ? pagoChofer : configActual?.aplicaImpuestoSobre === "utilidad_bruta" ? utilidadBruta : totalVentas) * (configActual?.porcentajeImpuesto ?? 0)) / 100;

  const liquidoChofer = Math.max(0, pagoChofer) + gastosChofer - impuesto - descuentosChofer;
  // Saldo arrastrado del período anterior (lo que el dueno le debía al chofer)
  const saldoArrastradoAnterior = configActual?.saldoPendienteLiquidacion || 0;

  // === DETECTAR COBROS DE SALDO ANTERIOR HECHOS EN ESTE PERÍODO ===
  // Si el chofer ya cobró (parcial o totalmente) el saldo del período anterior,
  // esa cantidad se descuenta del saldo arrastrado (porque ya se la pagaron).
  // Sino, el saldo se suma dos veces: una como "+ Saldo período anterior"
  // y otra como el efectivo que el chofer tiene en mano por el cobro.
  //
  // Los cobros se registran como Pagos con descripcion "Cobro de saldo anterior..."
  // y el endpoint /api/liquidacion/periodo los EXCLUYE del efectivoTotal.
  // Por eso hay que descontarlos acá del saldo arrastrado antes de calcular.
  const esCobroSaldoAnterior = (descripcion: string | null) => {
    if (!descripcion) return false;
    const d = descripcion.toLowerCase();
    return (
      d.includes("cobro de saldo anterior") ||
      d.includes("pago de saldo") ||
      (d.includes("saldo") && (d.includes("anterior") || d.includes("liquidación") || d.includes("liquidacion")))
    );
  };
  const cobrosSaldoAnterior = pagos
    .filter(p => esCobroSaldoAnterior(p.descripcion))
    .reduce((s, p) => s + p.monto, 0);
  // Saldo arrastrado efectivo = saldo anterior - lo que ya se cobró
  const saldoArrastradoEfectivo = Math.max(0, saldoArrastradoAnterior - cobrosSaldoAnterior);

  const saldoFinal = liquidoChofer - efectivoTotal + saldoArrastradoEfectivo;

  // Actualizar ultimoCierre + guardar el saldo final como arrastre para el próximo período
  const config = await db.configuracion.update({
    where: { duenoId },
    data: {
      ultimoCierre: fechaCierre,
      saldoPendienteLiquidacion: saldoFinal,
    },
  });

  return NextResponse.json({
    ok: true,
    ultimoCierre: config.ultimoCierre,
    saldoArrastrado: saldoFinal,
    message: `Período cerrado el ${fechaCierre.toLocaleDateString("es-CL")}. Saldo arrastrado al próximo período: ${saldoFinal >= 0 ? "Te deben" : "Debés"} ${Math.abs(saldoFinal)}.`,
  });
}
