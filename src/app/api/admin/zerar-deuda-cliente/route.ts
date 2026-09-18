import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/zerar-deuda-cliente?clienteId=XXX
//
// Resetea la deuda de un cliente a $0:
//   1. Setea deudaInicial = 0
//   2. Para cada entrega: setea montoRecibido = total, montoEfectivo = total,
//      montoTransferencia = 0, estadoPago = "pagado"
//   3. Si la entrega tiene detalleEstanquesJson, marca todos los estanques
//      como "efectivo" con montoRecibido = total
//   4. Borra todos los pagos sueltos del cliente (ya quedan aplicados a las entregas)
//
// USAR CON PRECAUCIÓN: esto resetea TODA la deuda del cliente. Si el cliente
// realmente debía algo, ese registro se pierde. Solo usar cuando se confirma
// que la deuda es imaginaria (bug del sistema, no real).
async function ejecutar(clienteId: string) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!clienteId) {
    return NextResponse.json({ error: "Falta clienteId" }, { status: 400 });
  }

  const cliente = await db.cliente.findUnique({
    where: { id: clienteId },
    select: { id: true, nombre: true, deudaInicial: true, duenoId: true },
  });
  if (!cliente || cliente.duenoId !== duenoId) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // Traer entregas y pagos actuales
  const [entregas, pagos] = await Promise.all([
    db.entrega.findMany({
      where: { clienteId },
      select: {
        id: true, fecha: true, litros: true, total: true,
        montoRecibido: true, montoEfectivo: true, montoTransferencia: true,
        estadoPago: true, detalleEstanquesJson: true,
      },
      orderBy: { fecha: "desc" },
    }),
    db.pago.findMany({
      where: { clienteId },
      select: { id: true, monto: true, metodoPago: true, fecha: true, descripcion: true },
    }),
  ]);

  const saldoAntes = (cliente.deudaInicial || 0)
    + entregas.reduce((s, e) => s + e.total, 0)
    - entregas.reduce((s, e) => s + e.montoRecibido, 0)
    - pagos.reduce((s, p) => s + p.monto, 0);

  // 1. Resetear deudaInicial
  await db.cliente.update({
    where: { id: clienteId },
    data: { deudaInicial: 0 },
  });

  // 2. Marcar todas las entregas como pagadas
  let entregasActualizadas = 0;
  for (const e of entregas) {
    let nuevosEstanquesJson = e.detalleEstanquesJson;
    if (e.detalleEstanquesJson) {
      try {
        const estanques = JSON.parse(e.detalleEstanquesJson);
        if (Array.isArray(estanques) && estanques.length > 0) {
          const actualizados = estanques.map((est: any) => ({
            ...est,
            metodoPago: "efectivo",
            montoRecibido: Number(est.total) || 0,
          }));
          nuevosEstanquesJson = JSON.stringify(actualizados);
        }
      } catch {}
    }
    await db.entrega.update({
      where: { id: e.id },
      data: {
        montoRecibido: e.total,
        montoEfectivo: e.total,
        montoTransferencia: 0,
        estadoPago: "pagado",
        detalleEstanquesJson: nuevosEstanquesJson,
      },
    });
    entregasActualizadas++;
  }

  // 3. Borrar todos los pagos sueltos (ya quedan aplicados a las entregas)
  let pagosBorrados = 0;
  for (const p of pagos) {
    await db.pago.delete({ where: { id: p.id } });
    pagosBorrados++;
  }

  return NextResponse.json({
    ok: true,
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
    },
    antes: {
      deudaInicial: cliente.deudaInicial || 0,
      totalVentas: entregas.reduce((s, e) => s + e.total, 0),
      totalRecibido: entregas.reduce((s, e) => s + e.montoRecibido, 0),
      totalPagosSueltos: pagos.reduce((s, p) => s + p.monto, 0),
      saldoFinal: saldoAntes,
    },
    despues: {
      deudaInicial: 0,
      totalVentas: entregas.reduce((s, e) => s + e.total, 0),
      totalRecibido: entregas.reduce((s, e) => s + e.total, 0),  // ahora todas pagadas
      totalPagosSueltos: 0,  // borrados
      saldoFinal: 0,  // deudaInicial=0 + ventas - recibido - 0 = 0
    },
    entregasActualizadas,
    pagosBorrados,
    message: `Deuda de ${cliente.nombre} zerada. Saldo antes: ${saldoAntes >= 0 ? "+" : ""}${saldoAntes.toLocaleString("es-CL")}. Saldo después: $0.`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  if (!clienteId) {
    return NextResponse.json({ error: "Falta ?clienteId=XXX" }, { status: 400 });
  }
  return ejecutar(clienteId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!body.clienteId) {
      return NextResponse.json({ error: "Falta clienteId en body" }, { status: 400 });
    }
    return ejecutar(body.clienteId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
