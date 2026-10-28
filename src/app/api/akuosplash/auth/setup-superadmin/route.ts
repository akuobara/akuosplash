import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie } from "@/lib/akuosplash-auth";
import bcrypt from "bcryptjs";

// POST /api/akuosplash/auth/setup-superadmin
// Crea un superadmin de prueba (solo para dev/testing — borrar en producción)
// Body: { email, password, nombre }
export async function POST(req: Request) {
  const body = await req.json();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  const nombre = body.nombre || "Superadmin";

  if (!email || !password) {
    return NextResponse.json({ error: "Email y password son obligatorios" }, { status: 400 });
  }

  const existente = await akuosplashDb.akuoUsuario.findUnique({ where: { email } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe con ese email" }, { status: 409 });
  }

  // Si no hay superadmin, este se convierte en el primero
  const haySuperadmin = await akuosplashDb.akuoUsuario.findFirst({ where: { rol: "superadmin" } });
  const passwordHash = await bcrypt.hash(password, 10);

  const nuevo = await akuosplashDb.akuoUsuario.create({
    data: {
      email, nombre, passwordHash,
      rol: haySuperadmin ? "cliente" : "superadmin",
      aprobado: true,
      activo: true,
      plan: "free",
      vehiculosPermitidos: 999,
    },
  });

  const token = await akuoSignToken({ userId: nuevo.id, rol: nuevo.rol, nombre: nuevo.nombre });
  await akuoSetSessionCookie(token);

  return NextResponse.json({ ok: true, user: { id: nuevo.id, email: nuevo.email, nombre: nuevo.nombre, rol: nuevo.rol } });
}
