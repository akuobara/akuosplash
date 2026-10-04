import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie, akuoNotificar } from "@/lib/akuosplash-auth";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const nombre = body.nombre?.trim();
    const telefono = body.telefono?.trim() || null;
    const rol = body.rol || "cliente";
    if (!email || !password || !nombre) return NextResponse.json({ error: "Email, contraseña y nombre son obligatorios" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    if (!["cliente", "transportista"].includes(rol)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    const existente = await akuosplashDb.akuoUsuario.findUnique({ where: { email } });
    if (existente) return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    const superadminExistente = await akuosplashDb.akuoUsuario.findFirst({ where: { rol: "superadmin" } });
    const rolFinal = superadminExistente ? rol : "superadmin";
    const passwordHash = await bcrypt.hash(password, 10);
    const vehiculosPermitidos = rolFinal === "superadmin" ? 999 : 1;
    const usuario = await akuosplashDb.akuoUsuario.create({ data: { email, nombre, telefono, passwordHash, rol: rolFinal, aprobado: rolFinal !== "transportista", plan: "free", vehiculosPermitidos } });
    await akuoNotificar(usuario.id, "bienvenida", "¡Bienvenido a AkuoSplash!", `Hola ${nombre}, tu cuenta fue creada como ${rolFinal}.`, "/akuosplash");
    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: usuario.id, email: usuario.email, telefono: usuario.telefono, nombre: usuario.nombre, rol: usuario.rol, aprobado: usuario.aprobado } });
  } catch (e) { console.error("Akuo register:", e); return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 }); }
}
