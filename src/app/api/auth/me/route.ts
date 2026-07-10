import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/auth/me
// Devuelve el usuario actual (o null si no hay sesión) + hasUsers (para saber si mostrar registro o login)
export async function GET() {
  const session = await getSession();

  if (session) {
    // Verificar que el usuario siga activo en la DB
    const user = await db.usuario.findUnique({
      where: { id: session.userId },
      select: { activo: true, role: true, nombre: true, email: true, duenoId: true },
    });

    if (!user || !user.activo) {
      return NextResponse.json({ user: null, hasUsers: true });
    }

    return NextResponse.json({
      user: {
        userId: session.userId,
        email: user.email,
        nombre: user.nombre,
        role: user.role,
        duenoId: user.duenoId,
      },
      hasUsers: true,
    });
  }

  // No hay sesión: verificar si hay usuarios registrados
  const userCount = await db.usuario.count();
  return NextResponse.json({ user: null, hasUsers: userCount > 0 });
}
