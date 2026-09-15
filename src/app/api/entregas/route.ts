import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange } from "@/lib/helpers";
import { checkDemoBlock } from "@/lib/demo-guard";
import { isFechaEnPeriodoCerrado } from "@/lib/periodo-cerrado";

// GET /api/entregas?period=...&clienteId=...
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
  const period = searchParams.get("period") || "todo";
  const clienteId = searchParams.get("clienteId");
  const { start, end } = getRange(period);

  // Si se pasa clienteId, obtener el nombre del cliente para también buscar
  // entregas manuales (clienteId=null) que coincidan por nombre
  let clienteNombreBusqueda: string | null = null;
  if (clienteId) {
    const cliente = await db.cliente.findUnique({
      where: { id: clienteId },
      select: { nombre: true }
    });
    if (cliente) clienteNombreBusqueda = cliente.nombre;
  }

  const where: Record<string, unknown> = {
    duenoId,
    AND: [
      start ? { fecha: { gte: start } } : {},
      end ? { fecha: { lt: end } } : {},
      // Si se pasa clienteId, buscar por clienteId O por nombre (para entregas manuales)
      clienteId ? {
        OR: [
          { clienteId },
          // Búsqueda bidireccional: el nombre de la entrega contiene el del cliente o viceversa
          ...(clienteNombreBusqueda ? [
            { clienteId: null, clienteNombre: { contains: clienteNombreBusqueda } },
            { clienteId: null, clienteNombre: clienteNombreBusqueda },
          ] : [])
        ]
      } : {},
    ],
  };

  if (session.role === "chofer") {
    where.choferId = session.userId;
  }

  const entregas = await db.entrega.findMany({
    where,
    include: {
      vuelta: { select: { id: true, numero: true, activa: true } },
    },
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json({ entregas });
}

// POST /api/entregas
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

    // === MODO "POR PRECIO": si el usuario ingresa montoTotal en vez de litros ===
    // Calcular litros desde el total + precioPorLitro
    let litros = Number(body.litros) || 0;
    let precioPorLitro = Number(body.precioPorLitro) || 0;

    if (body.modoPrecio === "por_precio" && body.precioTotal) {
      const precioTotal = Number(body.precioTotal) || 0;
      if (precioPorLitro > 0) {
        litros = Math.round(precioTotal / precioPorLitro);
      }
    }

    // === CÁLCULO DE TOTAL ===
    // Si es modo estanques (detalleEstanquesJson presente), usar el total del body
    // Si precioPorLitro es 0 (camión completo), usar el total del body (precio fijo)
    // Si no, calcular litros × precio
    let totalCalculado: number;
    if (body.detalleEstanquesJson) {
      // Modo estanques: el total viene del frontend (suma de estanques)
      totalCalculado = Number(body.total) || 0;
    } else if (precioPorLitro === 0 && body.total) {
      // Camión completo: el total viene del frontend (precio fijo), no recalcular
      totalCalculado = Number(body.total);
    } else {
      // Modo normal: calcular litros × precio
      totalCalculado = litros * precioPorLitro;
    }

    // Redondear a $100 superior (ej: 17448 → 17500)
    if (totalCalculado > 0) {
      totalCalculado = Math.ceil(totalCalculado / 100) * 100;
    }

    // === DESCUENTO ===
    const descuentoTipo = body.descuentoTipo || "ninguno"; // ninguno | total | por_litro
    const descuentoPor = body.descuentoPor || (session.role === "chofer" ? "chofer" : "dueno"); // dueno | chofer
    let descuento = 0;

    if (descuentoTipo === "total") {
      // Descuento sobre el total (ej: redondear de 21200 a 20000 → descuento 1200)
      descuento = Number(body.descuento) || 0;
    } else if (descuentoTipo === "por_litro") {
      // Descuento por litro (ej: 8$/L - 1$/L descuento = 7$/L)
      const descuentoPorLitro = Number(body.descuentoPorLitro) || 0;
      descuento = descuentoPorLitro * litros;
    }

    // Aplicar descuento al total
    const total = Math.max(0, totalCalculado - descuento);

    const metodoPago = body.metodoPago || "credito";
    const montoEfectivo = Number(body.montoEfectivo) || 0;
    const montoTransferencia = Number(body.montoTransferencia) || 0;
    const montoRecibido = montoEfectivo + montoTransferencia;

    let estadoPago = body.estadoPago || "pendiente";
    if (!body.estadoPago) {
      if (montoRecibido >= total && total > 0) estadoPago = "pagado";
      else if (montoRecibido > 0) estadoPago = "parcial";
      else estadoPago = "pendiente";
    }

    let litrosFinal = litros;
    if (!litrosFinal && body.lecturaAnterior != null && body.lecturaActual != null) {
      litrosFinal = Number(body.lecturaActual) - Number(body.lecturaAnterior);
    }

    // Validar litros no negativos
    if (litrosFinal < 0) {
      return NextResponse.json(
        { error: "Los litros no pueden ser negativos. Verifica las lecturas del medidor." },
        { status: 400 }
      );
    }

    // Vuelta activa
    let vueltaId = body.vueltaId || null;
    if (!vueltaId) {
      const where: Record<string, unknown> = { activa: true, duenoId };
      if (session.role === "chofer") {
        where.choferId = session.userId;
      }
      // Para dueño con múltiples choferes activos: usar la más reciente (determinista)
      const activa = await db.vuelta.findFirst({ where, orderBy: { iniciadaEn: "desc" } });
      vueltaId = activa?.id ?? null;
    }

    // Validar que clienteId pertenece al dueno si se proporciona
    if (body.clienteId) {
      const cliente = await db.cliente.findUnique({ where: { id: body.clienteId }, select: { duenoId: true } });
      if (!cliente || cliente.duenoId !== duenoId) {
        return NextResponse.json({ error: "El cliente no pertenece a tu organización" }, { status: 403 });
      }
    }

    // === BLOQUEO DE PERÍODO CERRADO ===
    // Si la fecha de la entrega es anterior al último cierre de período, bloquear.
    const fechaEntrega = body.fecha ? new Date(body.fecha) : new Date();
    if (await isFechaEnPeriodoCerrado(fechaEntrega)) {
      return NextResponse.json(
        { error: "No se pueden registrar entregas en un período cerrado. El período fue cerrado por el administrador." },
        { status: 403 }
      );
    }

    // === IDEMPOTENCIA: evitar entregas duplicadas por doble-click ===
    // Si en los últimos 30 segundos ya se creó una entrega idéntica (mismo cliente, vuelta, litros, total),
    // rechazar para prevenir duplicados.
    const hace30seg = new Date(Date.now() - 30 * 1000);
    const duplicada = await db.entrega.findFirst({
      where: {
        choferId: session.userId,
        duenoId,
        vueltaId: vueltaId ?? undefined,
        clienteId: body.clienteId || null,
        litros: litrosFinal,
        total,
        fecha: { gte: hace30seg },
      },
      select: { id: true },
    });
    if (duplicada) {
      return NextResponse.json(
        { error: "Ya registraste una entrega idéntica en los últimos 30 segundos. Espera un momento si quieres registrar otra." },
        { status: 409 }
      );
    }

    const nueva = await db.$transaction(async (tx) => {
      const creada = await tx.entrega.create({
        data: {
          fecha: body.fecha ? new Date(body.fecha) : new Date(),
          clienteNombre: body.clienteNombre?.trim() || "Sin nombre",
          clienteDireccion: body.clienteDireccion?.trim() || null,
          clienteTelefono: body.clienteTelefono?.trim() || null,
          clienteZona: body.clienteZona?.trim() || null,
          clienteId: body.clienteId || null,
          vueltaId,
          choferId: session.userId,
          duenoId,
          lecturaAnterior: body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null,
          lecturaActual: body.lecturaActual != null ? Number(body.lecturaActual) : null,
          litros: litrosFinal,
          metodoPago,
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
          nota: body.nota?.trim() || null,
          detalleEstanquesJson: body.detalleEstanquesJson || null,
        },
        include: {
          vuelta: { select: { id: true, numero: true, activa: true } },
        },
      });

      // Si viene de un pedido, vincularlo y marcarlo como entregado (validando ownership)
      if (body.pedidoId) {
        const pedido = await tx.pedido.findUnique({ where: { id: body.pedidoId } });
        if (!pedido || pedido.duenoId !== duenoId) {
          throw new Error("PEDIDO_NO_AUTORIZADO");
        }
        if (pedido.estado === "entregado") {
          throw new Error("PEDIDO_YA_ENTREGADO");
        }
        await tx.pedido.update({
          where: { id: body.pedidoId },
          data: {
            estado: "entregado",
            entregaId: creada.id,
            vueltaId: vueltaId,
          },
        });
      } else if (body.clienteId) {
        // Auto-vincular: buscar pedido pendiente/programado para este cliente
        // (el más reciente, sin importar la fecha exacta)
        const pedidoPendiente = await tx.pedido.findFirst({
          where: {
            clienteId: body.clienteId,
            duenoId,
            estado: { in: ["pendiente", "programado"] },
            entregaId: null,
          },
          orderBy: { fechaSolicitada: "asc" }, // el más antiguo primero
        });
        if (pedidoPendiente) {
          await tx.pedido.update({
            where: { id: pedidoPendiente.id },
            data: {
              estado: "entregado",
              entregaId: creada.id,
              vueltaId: vueltaId,
            },
          });
        }
      }

      return creada;
    });

    return NextResponse.json({ entrega: nueva }, { status: 201 });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "PEDIDO_NO_AUTORIZADO") {
        return NextResponse.json({ error: "El pedido no pertenece a tu organización" }, { status: 403 });
      }
      if (err.message === "PEDIDO_YA_ENTREGADO") {
        return NextResponse.json({ error: "Este pedido ya fue entregado" }, { status: 400 });
      }
    }
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear la entrega" }, { status: 500 });
  }
}
