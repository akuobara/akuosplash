import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/pagos?clienteId=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");

  const where: Record<string, unknown> = { duenoId };
  if (clienteId) where.clienteId = clienteId;

  const pagos = await db.pago.findMany({
    where,
    orderBy: { fecha: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ pagos });
}

// POST /api/pagos — registrar pago sin entrega
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    if (!body.clienteId) {
      return NextResponse.json({ error: "Cliente es obligatorio" }, { status: 400 });
    }

    const monto = Number(body.monto) || 0;
    if (monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    // Verificar que el cliente pertenece al dueño
    const cliente = await db.cliente.findUnique({ where: { id: body.clienteId } });
    if (!cliente || cliente.duenoId !== duenoId) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // Si se seleccionó "precio efectivo", recalcular las entregas impagas al precio efectivo
    if (body.precioEfectivo && cliente.precioEfectivoPorLitro > 0) {
      const precioEfectivo = cliente.precioEfectivoPorLitro;
      const precioTransferencia = cliente.precioTransferenciaPorLitro || precioEfectivo;

      // Buscar entregas del cliente que están pendientes o parcialmente pagadas
      // y que tienen precioPorLitro = precioTransferencia (deuda generada al precio más alto)
      const entregasImpagas = await db.entrega.findMany({
        where: {
          clienteId: body.clienteId,
          estadoPago: { in: ["pendiente", "parcial"] },
          precioPorLitro: precioTransferencia,
        },
        select: { id: true, litros: true, precioPorLitro: true, montoRecibido: true, descuento: true },
      });

      // Recalcular cada entrega al precio efectivo
      for (const entrega of entregasImpagas) {
        const nuevoTotal = Math.ceil((entrega.litros * precioEfectivo - (entrega.descuento || 0)) / 100) * 100;
        await db.entrega.update({
          where: { id: entrega.id },
          data: {
            precioPorLitro: precioEfectivo,
            total: Math.max(0, nuevoTotal),
          },
        });
      }
    }

    const nuevo = await db.pago.create({
      data: {
        clienteId: body.clienteId,
        monto,
        metodoPago: body.metodoPago || "efectivo",
        nota: body.nota?.trim() || null,
        choferId: session.userId,
        duenoId,
      },
      include: {
        cliente: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ pago: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo registrar el pago" }, { status: 500 });
  }
}
