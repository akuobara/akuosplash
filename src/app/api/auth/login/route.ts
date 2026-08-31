import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";

// POST /api/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "Email o teléfono y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const input = email.trim();
    const isPhone = /^[+]?[\d\s-]+$/.test(input) && input.replace(/\D/g, "").length >= 8;

    let user;
    if (isPhone) {
      // Buscar por teléfono (normalizar: solo dígitos)
      const phoneDigits = input.replace(/\D/g, "");
      user = await db.usuario.findFirst({
        where: {
          OR: [
            { telefono: phoneDigits },
            { telefono: "+" + phoneDigits },
            { telefono: input },
          ],
        },
      });
    } else {
      // Buscar por email
      user = await db.usuario.findUnique({
        where: { email: input.toLowerCase() },
      });
    }

    if (!user || !user.activo) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const sessionUser = {
      userId: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role as "dueno" | "chofer" | "super_admin",
      duenoId: user.duenoId,
    };

    const token = await signToken(sessionUser);
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    await setSessionCookie(token, isHttps);

    return NextResponse.json({ user: sessionUser, token });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
