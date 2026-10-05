import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ user: { id: user.id, email: user.email, nombre: user.nombre, telefono: user.telefono, avatarUrl: user.avatarUrl, rol: user.rol, plan: user.plan, creadoEn: user.creadoEn } });
}

export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const actualizado = await akuosplashDb.akuoUsuario.update({
    where: { id: user.id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.telefono !== undefined && { telefono: body.telefono?.trim() || null }),
    },
  });
  return NextResponse.json({ ok: true, user: { id: actualizado.id, nombre: actualizado.nombre, telefono: actualizado.telefono } });
}
