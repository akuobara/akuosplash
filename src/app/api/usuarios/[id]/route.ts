import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// PATCH /api/usuarios/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  // Verificar que el usuario pertenece al dueño actual
  const target = await db.usuario.findUnique({ where: { id } });
  if (!target || (target.duenoId !== session.userId && target.id !== session.userId)) {
    return NextResponse.json({ error: "No autorizado sobre este usuario" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.nombre !== undefined) data.nombre = body.nombre.trim();
  if (body.telefono !== undefined) data.telefono = body.telefono?.trim() || null;
  if (body.activo !== undefined) data.activo = !!body.activo;
  if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
  if (body.password) {
    if (body.password.length < 4) {
      return NextResponse.json({ error: "Contraseña mínima de 4 caracteres" }, { status: 400 });
    }
    data.passwordHash = hashPassword(body.password);
  }

  // No puede desactivarse a sí mismo (bloqueo permanente sin recuperación)
  // Usar data.activo (ya normalizado con !!) para cubrir todos los valores falsy: false, 0, null, "", etc.
  if (id === session.userId && data.activo === false) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }

  // Datos de licencia de chofer
  if (body.licenciaClase !== undefined) data.licenciaClase = body.licenciaClase || null;
  if (body.licenciaNumero !== undefined) data.licenciaNumero = body.licenciaNumero?.trim() || null;
  if (body.licenciaVencimiento !== undefined) data.licenciaVencimiento = body.licenciaVencimiento ? new Date(body.licenciaVencimiento) : null;
  if (body.licenciaFotoUrl !== undefined) data.licenciaFotoUrl = body.licenciaFotoUrl || null;

  // Si se está desactivando un chofer (activo: false), cerrar vueltas activas
  // y limpiar referencias operacionales. NO eliminamos CamionChofer para
  // permitir reactivación rápida del chofer sin tener que reasignarle camiones.
  if (data.activo === false && target.role === "chofer") {
    await db.$transaction(async (tx) => {
      await tx.vuelta.updateMany({
        where: { choferId: id, activa: true },
        data: { activa: false, cerradaEn: new Date() },
      });
      // NOTA: NO borramos CamionChofer — se conserva para que al reactivar
      // el chofer recupere automáticamente sus camiones asignados.
      await tx.pedido.updateMany({ where: { choferAsignadoId: id }, data: { choferAsignadoId: null } });
      await tx.pedido.updateMany({ where: { prioridadChoferId: id }, data: { prioridadChoferId: null, prioridadTipo: "ninguna" } });
      await tx.pedido.updateMany({ where: { tomadoPorChoferId: id }, data: { tomadoPorChoferId: null } });
      await tx.cliente.updateMany({ where: { choferPreferidoId: id }, data: { choferPreferidoId: null } });
      await tx.pedidoRecurrente.updateMany({ where: { choferAsignadoId: id }, data: { choferAsignadoId: null } });
      await tx.usuario.update({ where: { id }, data });
    });
  } else {
    await db.usuario.update({ where: { id }, data });
  }

  const actualizado = await db.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      nombre: true,
      telefono: true,
      role: true,
      activo: true,
      duenoId: true,
      creadoEn: true,
      licenciaClase: true,
      licenciaNumero: true,
      licenciaVencimiento: true,
      licenciaFotoUrl: true,
    },
  });

  return NextResponse.json({ usuario: actualizado });
}

// DELETE /api/usuarios/[id] — desactivar chofer (soft-delete para preservar historial)
// Cierra vueltas activas, elimina asignaciones de camiones, marca como inactivo.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;

  // No puede eliminarse a sí mismo
  if (id === session.userId) {
    return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
  }

  const target = await db.usuario.findUnique({ where: { id } });
  if (!target || target.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado sobre este usuario" }, { status: 403 });
  }

  // Soft-delete: marcar como inactivo + cerrar vueltas activas + limpiar referencias.
  // NO eliminamos CamionChofer para permitir reactivación rápida conservando camiones.
  await db.$transaction(async (tx) => {
    // Cerrar cualquier vuelta activa del chofer
    await tx.vuelta.updateMany({
      where: { choferId: id, activa: true },
      data: { activa: false, cerradaEn: new Date() },
    });

    // NOTA: NO borramos CamionChofer — se conserva para que al reactivar
    // el chofer recupere automáticamente sus camiones asignados.

    // Limpiar referencias en pedidos (asignación, prioridad, tomado)
    await tx.pedido.updateMany({
      where: { choferAsignadoId: id },
      data: { choferAsignadoId: null },
    });
    await tx.pedido.updateMany({
      where: { prioridadChoferId: id },
      data: { prioridadChoferId: null, prioridadTipo: "ninguna" },
    });
    await tx.pedido.updateMany({
      where: { tomadoPorChoferId: id },
      data: { tomadoPorChoferId: null },
    });

    // Limpiar chofer preferido en clientes
    await tx.cliente.updateMany({
      where: { choferPreferidoId: id },
      data: { choferPreferidoId: null },
    });

    // Limpiar asignación en pedidos recurrentes
    await tx.pedidoRecurrente.updateMany({
      where: { choferAsignadoId: id },
      data: { choferAsignadoId: null },
    });

    // Marcar usuario como inactivo (soft-delete)
    await tx.usuario.update({
      where: { id },
      data: { activo: false },
    });
  });

  return NextResponse.json({ ok: true });
}
