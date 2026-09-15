import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-cliente-saldo?clienteId=XXX
// Muestra el desglose completo del cálculo de deuda/saldo de un cliente:
//   - deudaInicial
//   - totalVentas (suma de entregas.total)
//   - totalRecibido (suma de entregas.montoRecibido)
//   - totalPagosSueltos (suma de pagos.monto)
//   - cada entrega con su total y montoRecibido (para detectar over-payment)
//   - cada pago suelto con su descripcion (para detectar phantom pagos)
//   - calculo final: deudaInicial + totalVentas - totalRecibido - totalPagosSueltos
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId en query params" }, { status: 400 });
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nombre: true, deudaInicial: true, duenoId: true },
  });
  if (!cliente || cliente.duenoId !== duenoId) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const entregas = await db.entrega.findMany({
    where: { clienteId },
    select: {
      id: true,
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

  const pagos = await db.pago.findMany({
    where: { clienteId },
    select: {
      id: true,
      fecha: true,
      monto: true,
      metodoPago: true,
      descripcion: true,
      nota: true,
      choferId: true,
    },
    orderBy: { fecha: "desc" },
  });

  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
  const deudaInicial = cliente.deudaInicial || 0;
  const saldoFinal = deudaInicial + totalVentas - totalRecibido - totalPagosSueltos;

  // Detectar entregas con over-payment (montoRecibido > total)
  const entregasOverpay = entregas
    .filter((e) => e.montoRecibido > e.total)
    .map((e) => ({
      id: e.id,
      fecha: String(e.fecha),
      litros: e.litros,
      total: e.total,
      montoRecibido: e.montoRecibido,
      excedente: e.montoRecibido - e.total,
      estadoPago: e.estadoPago,
    }));

  return NextResponse.json({
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      deudaInicial,
    },
    resumen: {
      totalEntregas: entregas.length,
      totalVentas,
      totalRecibido,
      totalPagosSueltos,
      saldoFinal,
      interpretacion:
        saldoFinal > 0
          ? `Cliente DEBE ${saldoFinal}`
          : saldoFinal < 0
            ? `Cliente TIENE SALDO A FAVOR de ${Math.abs(saldoFinal)}`
            : "Cliente sin deuda ni saldo a favor",
    },
    entregasOverpay,
    entregas: entregas.map((e) => ({
      id: e.id,
      fecha: String(e.fecha),
      litros: e.litros,
      total: e.total,
      montoRecibido: e.montoRecibido,
      estadoPago: e.estadoPago,
      overpay: e.montoRecibido > e.total ? e.montoRecibido - e.total : 0,
    })),
    pagos: pagos.map((p) => ({
      id: p.id,
      fecha: String(p.fecha),
      monto: p.monto,
      metodoPago: p.metodoPago,
      descripcion: p.descripcion,
      nota: p.nota,
      choferId: p.choferId,
    })),
  });
}
