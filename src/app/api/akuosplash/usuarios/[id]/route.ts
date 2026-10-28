import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PATCH /api/akuosplash/usuarios/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.nombre !== undefined) data.nombre = body.nombre.trim();
  if (body.telefono !== undefined) data.telefono = body.telefono || null;
  if (body.activo !== undefined) data.activo = !!body.activo;
  const actualizado = await akuosplashDb.akuoUsuario.update({ where: { id }, data });
  return NextResponse.json({ ok: true, usuario: { id: actualizado.id, nombre: actualizado.nombre, email: actualizado.email, role: actualizado.rol, activo: actualizado.activo } });
}

// DELETE /api/akuosplash/usuarios/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const { id } = await params;
  if (id === user.id) return NextResponse.json({ error: "No podés eliminarte a vos mismo" }, { status: 400 });
  await akuosplashDb.akuoUsuario.update({ where: { id }, data: { activo: false } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
