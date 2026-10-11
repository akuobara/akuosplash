import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie } from "@/lib/akuosplash-auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !password) return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
    const usuario = await akuosplashDb.akuoUsuario.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        nombre: true,
        telefono: true,
        rol: true,
        activo: true,
        aprobado: true,
        banned: true,
        banRazon: true,
        passwordHash: true,
        plan: true,
      },
    }).catch(() => null);
    if (!usuario || !usuario.passwordHash) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    const valid = await bcrypt.compare(password, usuario.passwordHash);
    if (!valid) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    if (!usuario.activo) return NextResponse.json({ error: "Tu cuenta está desactivada" }, { status: 403 });
    if (usuario.banned) return NextResponse.json({ error: `Tu cuenta está bloqueada: ${usuario.banRazon || "no especificado"}` }, { status: 403 });
    await akuosplashDb.akuoUsuario.update({ where: { id: usuario.id }, data: { ultimoLoginEn: new Date() } });
    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: usuario.id, email: usuario.email, telefono: usuario.telefono, nombre: usuario.nombre, rol: usuario.rol, aprobado: usuario.aprobado } });
  } catch (e) { console.error("Akuo login:", e); return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 }); }
}
