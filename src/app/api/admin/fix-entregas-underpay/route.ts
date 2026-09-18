import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/fix-entregas-underpay
//
// Para cada entrega con montoRecibido < total (sub-pagada):
//   - Si el cliente tiene pagos sueltos con el monto exacto que falta (o mayor),
//     usar ese pago para completar el montoRecibido de la entrega.
//   - Esto corrige el bug donde el montoRecibido se guardó en 0 o incompleto
//     aunque el cliente sí haya pagado (registrado como pago suelto).
//
// Modo:
//   GET → dry-run (muestra qué se arreglaría, no modifica nada)
//   POST con { confirmar: true } → aplica los cambios
async function ejecutar(confirmar: boolean) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Buscar todas las entregas sub-pagadas (montoRecibido < total)
  // SQLite no soporta row-level comparison en Prisma, así que traemos todas
  // y filtramos en JS.
  const haceUnAno = new Date();
  haceUnAno.setDate(haceUnAno.getDate() - 365);

  const todasEntregas = await db.entrega.findMany({
    where: {
      duenoId,
      fecha: { gte: haceUnAno },
      clienteId: { not: null },
    },
    select: {
      id: true,
      clienteId: true,
      fecha: true,
      litros: true,
      total: true,
      montoRecibido: true,
      montoEfectivo: true,
      montoTransferencia: true,
      estadoPago: true,
    },
    orderBy: { fecha: "desc" },
  });

  const subPagadas = todasEntregas.filter((e) => e.montoRecibido < e.total && e.total > 0);

  const arreglos: Array<{
    entregaId: string;
    clienteId: string;
    fecha: string;
    total: number;
    montoRecibidoAntes: number;
    montoRecibidoDespues: number;
    pagoUsadoId: string;
    pagoMonto: number;
    metodoPago: string;
  }> = [];
  let sinPagoParaCubrir = 0;

  for (const e of subPagadas) {
    if (!e.clienteId) continue;
    const falta = e.total - e.montoRecibido;
    if (falta <= 0) continue;

    // Buscar pagos sueltos del cliente con monto >= falta (preferible exacto)
    const pagos = await db.pago.findMany({
      where: {
        clienteId: e.clienteId,
        monto: { gte: falta },
      },
      select: { id: true, monto: true, metodoPago: true, fecha: true },
      orderBy: [{ monto: "asc" }, { fecha: "asc" }],
    });

    if (pagos.length === 0) {
      // No hay pago suelto que cubra la diferencia — la deuda es legítima
      sinPagoParaCubrir++;
      continue;
    }

    // Tomar el primer pago que cubre la diferencia (el más cercano al monto)
    const pagoUsado = pagos[0];
    const nuevoMontoRecibido = e.montoRecibido + falta;
    // El pago suelto se descuenta de la diferencia del pago suelto total

    // Actualizar la entrega con el nuevo montoRecibido
    // y recalcular efectivo/transferencia según el método del pago
    if (confirmar) {
      const nuevoEfectivo = pagoUsado.metodoPago === "efectivo"
        ? e.montoEfectivo + falta
        : e.montoEfectivo;
      const nuevoTransferencia = pagoUsado.metodoPago === "transferencia"
        ? e.montoTransferencia + falta
        : e.montoTransferencia;
      const nuevoEstado = nuevoMontoRecibido >= e.total ? "pagado" : "parcial";

      await db.entrega.update({
        where: { id: e.id },
        data: {
          montoRecibido: nuevoMontoRecibido,
          montoEfectivo: nuevoEfectivo,
          montoTransferencia: nuevoTransferencia,
          estadoPago: nuevoEstado,
        },
      });

      // Borrar el pago suelto porque ya quedó aplicado a la entrega
      await db.pago.delete({ where: { id: pagoUsado.id } });
    }

    arreglos.push({
      entregaId: e.id,
      clienteId: e.clienteId,
      fecha: String(e.fecha),
      total: e.total,
      montoRecibidoAntes: e.montoRecibido,
      montoRecibidoDespues: nuevoMontoRecibido,
      pagoUsadoId: pagoUsado.id,
      pagoMonto: pagoUsado.monto,
      metodoPago: pagoUsado.metodoPago,
    });
  }

  return NextResponse.json({
    ok: true,
    modo: confirmar ? "aplicado" : "dry-run",
    entregasSubPagadas: subPagadas.length,
    arregladas: arreglos.length,
    sinPagoParaCubrir,
    detalle: arreglos,
    message: confirmar
      ? `Se arreglaron ${arreglos.length} entrega(s). ${sinPagoParaCubrir} no tenían pago suelto que cubra la diferencia (deuda legítima).`
      : `Se detectaron ${arreglos.length} entrega(s) arreglables. ${sinPagoParaCubrir} tienen deuda legítima (sin pago suelto). Mandá POST con { confirmar: true } para aplicar.`,
  });
}

export async function GET() { return ejecutar(false); }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return ejecutar(body.confirmar === true);
  } catch {
    return ejecutar(false);
  }
}
