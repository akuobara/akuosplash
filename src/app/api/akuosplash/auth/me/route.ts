import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, email: user.email, telefono: user.telefono, nombre: user.nombre, rol: user.rol, aprobado: user.aprobado, plan: user.plan, avatarUrl: user.avatarUrl } });
}
