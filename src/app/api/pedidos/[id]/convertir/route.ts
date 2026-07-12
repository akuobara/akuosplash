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
// Body opcional: { litrosReales, precioPorLitro, montoEfectivo, montoTransferencia, fotoMedidorUrl, nota, detalleEstanquesJson }
// Si no se envían, se usan los valores del pedido (litrosSolicitados) y defaults de config.
//
// Implementación atómica: usa transacción + updateMany condicional para evitar race conditions.
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

  // Si el cliente tiene chofer preferido, solo ese chofer puede entregar el pedido
  // (el dueño no puede convertirlo a menos que él mismo sea el chofer preferido)
  if (pedido.clienteId) {
    const cliente = await db.cliente.findUnique({
      where: { id: pedido.clienteId },
      select: { choferPreferidoId: true, nombre: true },
    });
    if (cliente?.choferPreferidoId) {
      // El chofer preferido puede convertir
      if (session.role === "chofer" && session.userId !== cliente.choferPreferidoId) {
        const choferPreferido = await db.usuario.findUnique({
          where: { id: cliente.choferPreferidoId },
          select: { nombre: true },
        });
        return NextResponse.json(
          { error: `Este pedido solo puede ser entregado por ${choferPreferido?.nombre ?? "el chofer preferido"} del cliente ${cliente.nombre}.` },
          { status: 403 }
        );
      }
      // El dueño no puede convertir si hay un chofer preferido (a menos que sea él mismo)
      if (session.role === "dueno" && session.userId !== cliente.choferPreferidoId) {
        const choferPreferido = await db.usuario.findUnique({
          where: { id: cliente.choferPreferidoId },
          select: { nombre: true },
        });
        return NextResponse.json(
          { error: `Este cliente tiene a ${choferPreferido?.nombre ?? "un chofer preferido"} asignado. Solo ese chofer puede entregar el pedido. Si necesitas entregarlo tú, cambia el chofer preferido del cliente o reasigna el pedido.` },
          { status: 403 }
        );
      }
    }
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Determinar precio según método preferido
    const config = await db.configuracion.findUnique({ where: { duenoId } });

    // Si el cliente del catálogo tiene precios propios, usarlos
    let precioEfectivoCfg = config?.precioEfectivoPorLitro || 0;
    let precioTransferenciaCfg = config?.precioTransferenciaPorLitro || 0;
    if (pedido.clienteId) {
      const cliente = await db.cliente.findUnique({ where: { id: pedido.clienteId } });
      if (cliente) {
        precioEfectivoCfg = cliente.precioEfectivoPorLitro || precioEfectivoCfg;
        precioTransferenciaCfg = cliente.precioTransferenciaPorLitro || precioTransferenciaCfg;
      }
    }

    // Método de pago: usar el del body si se proporciona, sino el del pedido
    const metodoPagoFinal = body.metodoPago || pedido.metodoPagoPreferido;

    let precioPorLitro = Number(body.precioPorLitro) || 0;
    if (!precioPorLitro) {
      if (metodoPagoFinal === "efectivo") {
        precioPorLitro = precioEfectivoCfg;
      } else if (metodoPagoFinal === "transferencia") {
        precioPorLitro = precioTransferenciaCfg;
      } else {
        // credito (sin pago) o mixto: precio MÁS ALTO para generar deuda
        precioPorLitro = Math.max(precioEfectivoCfg, precioTransferenciaCfg);
      }
    }

    // Litros: usar litrosReales si se envió explícitamente (incluyendo 0), sino litrosSolicitados
    let litros: number;
    if (body.litrosReales != null && body.litrosReales !== "") {
      litros = Number(body.litrosReales);
      if (isNaN(litros) || litros < 0) {
        return NextResponse.json({ error: "Los litros reales deben ser un número ≥ 0" }, { status: 400 });
      }
    } else {
      litros = pedido.litrosSolicitados;
    }

    // Total con redondeo a $100 superior
    let totalCalc = litros * precioPorLitro;
    if (totalCalc > 0) totalCalc = Math.ceil(totalCalc / 100) * 100;

    // Descuento
    const descuentoTipo = body.descuentoTipo || "ninguno";
    const descuentoPor = session.role === "chofer" ? "chofer" : "dueno";
    let descuento = 0;
    if (descuentoTipo === "total") {
      descuento = Number(body.descuento) || 0;
    }

    const total = Math.max(0, totalCalc - descuento);
    const montoEfectivo = Number(body.montoEfectivo) || 0;
    const montoTransferencia = Number(body.montoTransferencia) || 0;
    const montoRecibido = montoEfectivo + montoTransferencia;

    let estadoPago = "pendiente";
    if (montoRecibido >= total && total > 0) estadoPago = "pagado";
    else if (montoRecibido > 0) estadoPago = "parcial";

    // Determinar el choferId: si es chofer, su propio id; si es dueño, usar el choferAsignadoId o tomadoPorChoferId del pedido
    let choferIdParaEntrega: string | null = session.userId;
    if (session.role === "dueno") {
      choferIdParaEntrega = pedido.tomadoPorChoferId || pedido.choferAsignadoId || pedido.choferId || session.userId;
    }

    // Buscar vuelta activa para asignar la entrega — usar el choferId correcto
    const vueltaWhere: Record<string, unknown> = { activa: true, duenoId };
    if (session.role === "chofer") {
      vueltaWhere.choferId = session.userId;
    } else if (choferIdParaEntrega) {
      // Dueño: usar la vuelta activa del chofer que tiene el pedido
      vueltaWhere.choferId = choferIdParaEntrega;
    }
    const vueltaActiva = await db.vuelta.findFirst({
      where: vueltaWhere,
      orderBy: { iniciadaEn: "desc" },
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

    // TRANSACCIÓN: crear entrega + marcar pedido como entregado atómicamente
    const result = await db.$transaction(async (tx) => {
      // 1. Crear la entrega
      const nuevaEntrega = await tx.entrega.create({
        data: {
          fecha: new Date(),
          clienteNombre: pedido.clienteNombre,
          clienteDireccion: pedido.clienteDireccion,
          clienteTelefono: pedido.clienteTelefono,
          clienteZona: pedido.clienteZona,
          clienteId: pedido.clienteId,
          vueltaId: vueltaActiva.id,
          choferId: choferIdParaEntrega,
          duenoId,
          litros,
          metodoPago: metodoPagoFinal,
          precioPorLitro,
          total,
          montoEfectivo,
          montoTransferencia,
          montoRecibido,
          estadoPago,
          descuento,
          descuentoTipo,
          descuentoPor,
          fotoMedidorUrl: body.fotoMedidorUrl || null,
          nota: body.nota?.trim() || pedido.nota || null,
          detalleEstanquesJson: body.detalleEstanquesJson || null,
        },
      });

      // 2. Marcar el pedido como entregado de forma atómica
      // updateMany con condición estado para evitar race: si otro proceso ya lo marcó, count=0
      const pedidoUpdate = await tx.pedido.updateMany({
        where: {
          id,
          estado: { in: ["pendiente", "programado", "en_ruta"] },
        },
        data: {
          estado: "entregado",
          entregaId: nuevaEntrega.id,
          vueltaId: vueltaActiva.id,
        },
      });

      if (pedidoUpdate.count === 0) {
        // El pedido ya fue entregado por otro proceso — revertir la transacción
        throw new Error("CONFLICT: Este pedido ya fue entregado por otro proceso");
      }

      return { nuevaEntrega };
    });

    // Recargar el pedido actualizado
    const pedidoActualizado = await db.pedido.findUnique({ where: { id } });

    return NextResponse.json({
      pedido: pedidoActualizado,
      entrega: result.nuevaEntrega,
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("CONFLICT:")) {
      return NextResponse.json({ error: err.message.replace("CONFLICT: ", "") }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo convertir el pedido en entrega" }, { status: 500 });
  }
}
