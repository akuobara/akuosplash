import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";
import { isFechaEnPeriodoCerrado } from "@/lib/periodo-cerrado";

async function checkOwnership(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const duenoId = await getDuenoId();
  if (!duenoId) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };

  const entrega = await db.entrega.findUnique({ where: { id } });
  if (!entrega || entrega.duenoId !== duenoId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }
  if (session.role === "chofer" && entrega.choferId !== session.userId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

// PATCH /api/entregas/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const { id } = await params;
  const { error: authError } = await checkOwnership(id);
  if (authError) return authError;

  // === BLOQUEO DE PERÍODO CERRADO ===
  // Verificar si la entrega existente está en un período cerrado
  const entregaExistente = await db.entrega.findUnique({ where: { id }, select: { fecha: true } });
  if (entregaExistente && await isFechaEnPeriodoCerrado(entregaExistente.fecha)) {
    return NextResponse.json(
      { error: "No se pueden editar entregas de un período cerrado." },
      { status: 403 }
    );
  }

  const body = await req.json();

  // Validar que clienteId pertenece al dueno si se está cambiando
  if (body.clienteId !== undefined && body.clienteId) {
    const entregaActual = await db.entrega.findUnique({ where: { id }, select: { duenoId: true } });
    const cliente = await db.cliente.findUnique({ where: { id: body.clienteId }, select: { duenoId: true } });
    if (!cliente || cliente.duenoId !== entregaActual?.duenoId) {
      return NextResponse.json({ error: "El cliente no pertenece a tu organización" }, { status: 403 });
    }
  }

  const litros = body.litros != null ? Number(body.litros) : undefined;
  let precioPorLitro = body.precioPorLitro != null ? Number(body.precioPorLitro) : undefined;

  // Total: recalcular si viene litros o precio o total
  let total: number | undefined;
  if (typeof body.total === "number" && body.total > 0) {
    total = body.total;
  } else if (litros != null && precioPorLitro != null) {
    total = litros * precioPorLitro;
    if (total > 0) total = Math.ceil(total / 100) * 100;
  } else if (litros != null) {
    // Si solo viene litros, usar el precio existente
    const actual = await db.entrega.findUnique({ where: { id }, select: { precioPorLitro: true } });
    const precio = precioPorLitro ?? actual?.precioPorLitro ?? 0;
    if (precio > 0) {
      total = litros * precio;
      if (total > 0) total = Math.ceil(total / 100) * 100;
      precioPorLitro = precio;
    }
  }

  const montoEfectivo = body.montoEfectivo != null ? Number(body.montoEfectivo) : undefined;
  const montoTransferencia = body.montoTransferencia != null ? Number(body.montoTransferencia) : undefined;

  let montoRecibido: number | undefined;
  if (montoEfectivo != null || montoTransferencia != null) {
    const actual = await db.entrega.findUnique({ where: { id } });
    const ef = montoEfectivo ?? actual?.montoEfectivo ?? 0;
    const tr = montoTransferencia ?? actual?.montoTransferencia ?? 0;
    montoRecibido = ef + tr;
  }

  let estadoPago: string | undefined;
  if (montoRecibido != null || total != undefined || body.estadoPago !== undefined) {
    if (body.estadoPago !== undefined) {
      estadoPago = body.estadoPago;
    } else {
      const totalFinal = total ?? (await db.entrega.findUnique({ where: { id } }))?.total ?? 0;
      if (montoRecibido != null) {
        if (montoRecibido >= totalFinal && totalFinal > 0) estadoPago = "pagado";
        else if (montoRecibido > 0) estadoPago = "parcial";
        else estadoPago = "pendiente";
      }
    }
  }

  // Si se cambia metodoPago pero no se envían montoEfectivo/montoTransferencia,
  // recalcular automáticamente según el nuevo método
  let montoEfectivoFinal = montoEfectivo;
  let montoTransferenciaFinal = montoTransferencia;
  let montoRecibidoFinal = montoRecibido;
  if (body.metodoPago !== undefined && montoEfectivo === undefined && montoTransferencia === undefined) {
    const actual = await db.entrega.findUnique({ where: { id } });
    const totalActual = total ?? actual?.total ?? 0;
    const recibidoActual = actual?.montoRecibido ?? 0;
    if (body.metodoPago === "efectivo") {
      montoEfectivoFinal = recibidoActual;
      montoTransferenciaFinal = 0;
    } else if (body.metodoPago === "transferencia") {
      montoEfectivoFinal = 0;
      montoTransferenciaFinal = recibidoActual;
    } else if (body.metodoPago === "mixto") {
      // dejar como está
    } else if (body.metodoPago === "credito") {
      montoEfectivoFinal = 0;
      montoTransferenciaFinal = 0;
    }
    if (montoEfectivoFinal !== undefined || montoTransferenciaFinal !== undefined) {
      montoRecibidoFinal = (montoEfectivoFinal ?? 0) + (montoTransferenciaFinal ?? 0);
    }
  }

  const actualizada = await db.entrega.update({
    where: { id },
    data: {
      ...(body.fecha !== undefined && { fecha: new Date(body.fecha) }),
      ...(body.clienteNombre !== undefined && { clienteNombre: body.clienteNombre.trim() }),
      ...(body.clienteDireccion !== undefined && { clienteDireccion: body.clienteDireccion?.trim() || null }),
      ...(body.clienteTelefono !== undefined && { clienteTelefono: body.clienteTelefono?.trim() || null }),
      ...(body.clienteZona !== undefined && { clienteZona: body.clienteZona?.trim() || null }),
      ...(body.clienteId !== undefined && { clienteId: body.clienteId || null }),
      ...(body.vueltaId !== undefined && { vueltaId: body.vueltaId || null }),
      ...(body.lecturaAnterior !== undefined && { lecturaAnterior: body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null }),
      ...(body.lecturaActual !== undefined && { lecturaActual: body.lecturaActual != null ? Number(body.lecturaActual) : null }),
      ...(litros !== undefined && { litros }),
      ...(body.metodoPago !== undefined && { metodoPago: body.metodoPago }),
      ...(precioPorLitro !== undefined && { precioPorLitro }),
      ...(total !== undefined && { total }),
      ...(montoEfectivoFinal !== undefined && { montoEfectivo: montoEfectivoFinal }),
      ...(montoTransferenciaFinal !== undefined && { montoTransferencia: montoTransferenciaFinal }),
      ...(montoRecibidoFinal !== undefined && { montoRecibido: montoRecibidoFinal }),
      ...(estadoPago !== undefined && { estadoPago }),
      ...(body.fotoMedidorUrl !== undefined && { fotoMedidorUrl: body.fotoMedidorUrl || null }),
      ...(body.detalleEstanquesJson !== undefined && { detalleEstanquesJson: body.detalleEstanquesJson || null }),
      ...(body.nota !== undefined && { nota: body.nota?.trim() || null }),
    },
    include: { vuelta: { select: { id: true, numero: true, activa: true } } },
  });

  // Si viene de un pedido (en edición), vincularlo — validando ownership
  if (body.pedidoId) {
    const pedido = await db.pedido.findUnique({ where: { id: body.pedidoId } });
    if (!pedido || pedido.duenoId !== actualizada.duenoId) {
      return NextResponse.json({ error: "El pedido no pertenece a tu organización" }, { status: 403 });
    }
    if (pedido.estado === "entregado" && pedido.entregaId !== id) {
      return NextResponse.json({ error: "Este pedido ya fue entregado en otra entrega" }, { status: 400 });
    }
    try {
      await db.pedido.update({
        where: { id: body.pedidoId },
        data: {
          estado: "entregado",
          entregaId: actualizada.id,
          ...(body.vueltaId !== undefined && { vueltaId: body.vueltaId || null }),
        },
      });
    } catch (e) {
      console.error("No se pudo vincular el pedido:", e);
    }
  }

  return NextResponse.json({ entrega: actualizada });
}

// DELETE /api/entregas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const { id } = await params;
  const { error: authError } = await checkOwnership(id);
  if (authError) return authError;

  // Si la entrega estaba vinculada a un pedido, revertir el pedido a "pendiente"
  // y desvincularlo para que pueda ser re-entregado.
  await db.pedido.updateMany({
    where: { entregaId: id },
    data: {
      estado: "pendiente",
      entregaId: null,
      vueltaId: null,
    },
  });

  await db.entrega.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
