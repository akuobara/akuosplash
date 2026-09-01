import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") {
    return null;
  }
  return session;
}

// GET /api/super-admin/usuarios — lista todos los usuarios
export async function GET() {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const usuarios = await db.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        role: true,
        activo: true,
        creadoEn: true,
        duenoId: true,
        telefono: true,
      },
      orderBy: [{ role: "asc" }, { nombre: "asc" }],
    });

    return NextResponse.json({ usuarios });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

// POST /api/super-admin/usuarios — crear nuevo administrador
export async function POST(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, email, password, telefono } = body;

    if (!nombre?.trim() || !email?.trim() || !password) {
      return NextResponse.json({ error: "Nombre, email y password son obligatorios" }, { status: 400 });
    }

    const emailNorm = email.trim().toLowerCase();
    const existente = await db.usuario.findUnique({ where: { email: emailNorm } });
    if (existente) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }

    const nuevo = await db.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailNorm,
        passwordHash: hashPassword(String(password)),
        telefono: telefono?.trim() || null,
        role: "dueno",
        activo: true,
      },
      select: { id: true, nombre: true, email: true, role: true, activo: true },
    });

    return NextResponse.json({ usuario: nuevo }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo crear el administrador" }, { status: 500 });
  }
}

// PATCH /api/super-admin/usuarios — activar/desactivar usuario + cambiar rol
export async function PATCH(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, activo, role } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es obligatorio" }, { status: 400 });
    }

    // No desactivarse ni cambiar rol a sí mismo
    if (userId === session.userId) {
      return NextResponse.json({ error: "No puedes modificar tu propia cuenta" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (activo !== undefined) data.activo = !!activo;
    if (role !== undefined) {
      if (!["dueno", "chofer", "super_admin"].includes(role)) {
        return NextResponse.json({ error: "Rol no válido" }, { status: 400 });
      }
      data.role = role;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const actualizado = await db.usuario.update({
      where: { id: userId },
      data,
      select: { id: true, nombre: true, activo: true, role: true },
    });

    return NextResponse.json({ usuario: actualizado });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}

// DELETE /api/super-admin/usuarios — eliminar un usuario (no admin)
export async function DELETE(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId es obligatorio" }, { status: 400 });
    }

    if (userId === session.userId) {
      return NextResponse.json({ error: "No puedes eliminar tu propia cuenta" }, { status: 400 });
    }

    const usuario = await db.usuario.findUnique({ where: { id: userId }, select: { role: true, duenoId: true } });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    if (usuario.role === "dueno") {
      return NextResponse.json({ error: "Para eliminar un administrador, usá el endpoint de administradores" }, { status: 400 });
    }

    await db.usuario.delete({ where: { id: userId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo eliminar el usuario" }, { status: 500 });
  }
}
