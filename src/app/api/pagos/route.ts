import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";
import { isFechaEnPeriodoCerrado } from "@/lib/periodo-cerrado";

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
      chofer: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ pagos });
}

// POST /api/pagos — registrar pago sin entrega
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

  try {
    const body = await req.json();

    const monto = Number(body.monto) || 0;
    if (monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }

    // Pago sin cliente (pago general: alquiler, reembolso, etc.)
    if (!body.clienteId) {
      if (!body.descripcion?.trim()) {
        return NextResponse.json({ error: "Para pagos sin cliente, la descripción es obligatoria" }, { status: 400 });
      }
      const nuevo = await db.pago.create({
        data: {
          clienteId: null,
          monto,
          metodoPago: body.metodoPago || "efectivo",
          descripcion: body.descripcion?.trim() || null,
          nota: body.nota?.trim() || null,
          choferId: session.userId,
          duenoId,
        },
      });
      return NextResponse.json({ pago: nuevo }, { status: 201 });
    }

    // Verificar que el cliente pertenece al dueño
    const cliente = await db.cliente.findUnique({ where: { id: body.clienteId } });
    if (!cliente || cliente.duenoId !== duenoId) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // === BLOQUEO DE PERÍODO CERRADO ===
    if (await isFechaEnPeriodoCerrado(new Date())) {
      return NextResponse.json(
        { error: "No se pueden registrar pagos en un período cerrado." },
        { status: 403 }
      );
    }

    // Si se seleccionó "precio efectivo", recalcular las entregas impagas al precio efectivo
    if (body.precioEfectivo) {
      // Usar el precio efectivo del cliente, o si es 0, el del global (configuración)
      const config = await db.configuracion.findUnique({ where: { duenoId } });
      const precioEfectivo = cliente.precioEfectivoPorLitro || config?.precioEfectivoPorLitro || 0;
      const precioTransferencia = cliente.precioTransferenciaPorLitro || config?.precioTransferenciaPorLitro || precioEfectivo;

      if (precioEfectivo > 0 && precioTransferencia > precioEfectivo) {
        // Buscar entregas del cliente que están pendientes o parcialmente pagadas
        // y que tienen precioPorLitro > precioEfectivo (fueron generadas al precio transferencia).
        const entregasImpagas = await db.entrega.findMany({
          where: {
            clienteId: body.clienteId,
            estadoPago: { in: ["pendiente", "parcial"] },
            precioPorLitro: { gt: precioEfectivo },
          },
          select: { id: true, litros: true, precioPorLitro: true, montoRecibido: true, descuento: true, montoEfectivo: true, montoTransferencia: true },
        });

        // Recalcular cada entrega al precio efectivo
        for (const entrega of entregasImpagas) {
          // Nuevo total = litros × precio efectivo, redondeado a $100, menos descuento
          const totalBruto = entrega.litros * precioEfectivo;
          const totalRedondeado = totalBruto > 0 ? Math.ceil(totalBruto / 100) * 100 : 0;
          const nuevoTotal = Math.max(0, totalRedondeado - (entrega.descuento || 0));

          // Recalcular estado de pago
          let nuevoEstado = "pendiente";
          if (entrega.montoRecibido >= nuevoTotal && nuevoTotal > 0) nuevoEstado = "pagado";
          else if (entrega.montoRecibido > 0) nuevoEstado = "parcial";

          await db.entrega.update({
            where: { id: entrega.id },
            data: {
              precioPorLitro: precioEfectivo,
              total: nuevoTotal,
              estadoPago: nuevoEstado,
            },
          });
        }
      }
    }

    const nuevo = await db.pago.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        clienteId: body.clienteId,
        monto,
        metodoPago: body.metodoPago || "efectivo",
        descripcion: body.descripcion?.trim() || null,
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
