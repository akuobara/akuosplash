import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/pedidos/[id]/convertir
// Convierte un pedido en una entrega:
// 1. Crea una Entrega con los datos del pedido
// 2. La vincula al pedido (entregaId)
// 3. Marca el pedido como "entregado"
// 4. Si hay vuelta activa, la asigna a esa vuelta
//
// Body opcional: { litrosReales, precioPorLitro, montoEfectivo, montoTransferencia, fotoMedidorUrl, nota }
// Si no se envían, se usan los valores del pedido (litrosSolicitados) y defaults de config.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (pedido.estado === "entregado") {
    return NextResponse.json({ error: "Este pedido ya fue entregado" }, { status: 400 });
  }

  if (pedido.estado === "cancelado") {
    return NextResponse.json({ error: "No se puede entregar un pedido cancelado" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Determinar precio según método preferido
    const config = await db.configuracion.findUnique({ where: { duenoId } });
    let precioPorLitro = Number(body.precioPorLitro) || 0;

    // Si el cliente del catálogo tiene precios propios, usarlos
    if (pedido.clienteId) {
      const cliente = await db.cliente.findUnique({ where: { id: pedido.clienteId } });
      if (cliente) {
        const precioEfectivo = cliente.precioEfectivoPorLitro || config?.precioEfectivoPorLitro || 0;
        const precioTransferencia = cliente.precioTransferenciaPorLitro || config?.precioTransferenciaPorLitro || 0;
        if (pedido.metodoPagoPreferido === "efectivo") {
          precioPorLitro = precioEfectivo;
        } else if (pedido.metodoPagoPreferido === "transferencia") {
          precioPorLitro = precioTransferencia;
        } else {
          // credito (sin pago) o mixto: precio MÁS ALTO para generar deuda
          precioPorLitro = Math.max(precioEfectivo, precioTransferencia);
        }
      }
    }
    if (!precioPorLitro) {
      // Fallback a config si no hay cliente o precios propios
      const precioEfectivo = config?.precioEfectivoPorLitro || 0;
      const precioTransferencia = config?.precioTransferenciaPorLitro || 0;
      if (pedido.metodoPagoPreferido === "efectivo") {
        precioPorLitro = precioEfectivo;
      } else if (pedido.metodoPagoPreferido === "transferencia") {
        precioPorLitro = precioTransferencia;
      } else {
        precioPorLitro = Math.max(precioEfectivo, precioTransferencia);
      }
    }

    const litros = Number(body.litrosReales) || pedido.litrosSolicitados;
    const total = litros * precioPorLitro;
    const montoEfectivo = Number(body.montoEfectivo) || 0;
    const montoTransferencia = Number(body.montoTransferencia) || 0;
    const montoRecibido = montoEfectivo + montoTransferencia;

    let estadoPago = "pendiente";
    if (montoRecibido >= total && total > 0) estadoPago = "pagado";
    else if (montoRecibido > 0) estadoPago = "parcial";

    // Buscar vuelta activa para asignar la entrega
    const vueltaWhere: Record<string, unknown> = { activa: true, duenoId };
    if (session.role === "chofer") {
      vueltaWhere.choferId = session.userId;
    }
    const vueltaActiva = await db.vuelta.findFirst({
      where: vueltaWhere,
      include: {
        camion: { select: { capacidad: true } },
        entregas: { select: { litros: true } },
      },
    });

    // Validar que haya vuelta activa
    if (!vueltaActiva) {
      return NextResponse.json(
        { error: "No hay vuelta activa. Inicia una vuelta antes de entregar pedidos." },
        { status: 400 }
      );
    }

    // Crear la entrega
    const nuevaEntrega = await db.entrega.create({
      data: {
        fecha: new Date(),
        clienteNombre: pedido.clienteNombre,
        clienteDireccion: pedido.clienteDireccion,
        clienteTelefono: pedido.clienteTelefono,
        clienteZona: pedido.clienteZona,
        clienteId: pedido.clienteId,
        vueltaId: vueltaActiva?.id ?? null,
        choferId: session.userId,
        duenoId,
        litros,
        metodoPago: pedido.metodoPagoPreferido,
        precioPorLitro,
        total,
        montoEfectivo,
        montoTransferencia,
        montoRecibido,
        estadoPago,
        fotoMedidorUrl: body.fotoMedidorUrl || null,
        nota: body.nota?.trim() || pedido.nota || null,
        detalleEstanquesJson: body.detalleEstanquesJson || null,
      },
    });

    // Marcar el pedido como entregado y vincularlo a la entrega
    const pedidoActualizado = await db.pedido.update({
      where: { id },
      data: {
        estado: "entregado",
        entregaId: nuevaEntrega.id,
        vueltaId: vueltaActiva?.id ?? null,
      },
    });

    return NextResponse.json({
      pedido: pedidoActualizado,
      entrega: nuevaEntrega,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo convertir el pedido en entrega" }, { status: 500 });
  }
}
