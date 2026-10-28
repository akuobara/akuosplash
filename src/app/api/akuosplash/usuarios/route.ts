import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import bcrypt from "bcryptjs";

// GET /api/akuosplash/usuarios — lista de usuarios del equipo del transportista
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  // En AkuoSplash, el transportista es su propio equipo (no hay choferes subordinados todavía)
  // Devolver solo al transportista
  return NextResponse.json({
    usuarios: [{
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      role: user.rol,
      activo: user.activo,
    }],
  });
}

// POST /api/akuosplash/usuarios — crear usuario (chofer subordinado)
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const body = await req.json();
  if (!body.email?.trim() || !body.nombre?.trim() || !body.password) {
    return NextResponse.json({ error: "Email, nombre y contraseña son obligatorios" }, { status: 400 });
  }
  const existente = await akuosplashDb.akuoUsuario.findUnique({ where: { email: body.email.trim().toLowerCase() } });
  if (existente) return NextResponse.json({ error: "Ya existe con ese email" }, { status: 409 });
  const passwordHash = await bcrypt.hash(body.password, 10);
  const nuevo = await akuosplashDb.akuoUsuario.create({
    data: {
      email: body.email.trim().toLowerCase(),
      nombre: body.nombre.trim(),
      telefono: body.telefono || null,
      passwordHash,
      rol: "transportista",
      aprobado: true,
      activo: true,
      plan: "free",
      vehiculosPermitidos: 1,
    },
  });
  return NextResponse.json({ ok: true, usuario: { id: nuevo.id, nombre: nuevo.nombre, email: nuevo.email, role: nuevo.rol, activo: nuevo.activo } }, { status: 201 });
}
