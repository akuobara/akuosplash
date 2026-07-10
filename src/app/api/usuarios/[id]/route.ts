import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getSession } from "@/lib/auth";

// PATCH /api/usuarios/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo dueños" }, { status: 403 });
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

  const actualizado = await db.usuario.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      nombre: true,
      telefono: true,
      role: true,
      activo: true,
      duenoId: true,
      creadoEn: true,
    },
  });

  return NextResponse.json({ usuario: actualizado });
}

// DELETE /api/usuarios/[id] — desactivar (no borrar para preservar historial)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo dueños" }, { status: 403 });
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

  // Eliminar asignaciones de camiones
  await db.camionChofer.deleteMany({ where: { choferId: id } });

  // Eliminar usuario
  await db.usuario.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
