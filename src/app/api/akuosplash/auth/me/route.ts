import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ user: null, hasUsers: true });
  return NextResponse.json({
    user: {
      id: user.id,
      userId: user.id, // alias para compatibilidad con código de Aljibe
      email: user.email,
      telefono: user.telefono,
      nombre: user.nombre,
      rol: user.rol,
      role: user.rol, // alias para compatibilidad con código de Aljibe
      aprobado: user.aprobado,
      plan: user.plan,
      avatarUrl: user.avatarUrl,
      activo: user.activo,
    },
    hasUsers: true,
  });
}
