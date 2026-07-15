import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

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
      },
      orderBy: [{ role: "asc" }, { nombre: "asc" }],
    });

    return NextResponse.json({ usuarios });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener usuarios" }, { status: 500 });
  }
}

// PATCH /api/super-admin/usuarios — activar/desactivar usuario
export async function PATCH(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, activo } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId es obligatorio" }, { status: 400 });
    }

    // No desactivarse a sí mismo
    if (userId === session.userId) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
    }

    const actualizado = await db.usuario.update({
      where: { id: userId },
      data: { activo: !!activo },
      select: { id: true, nombre: true, activo: true },
    });

    return NextResponse.json({ usuario: actualizado });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
