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
        { error: "Email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    const user = await db.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

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
      role: user.role as "dueno" | "chofer",
      duenoId: user.duenoId,
    };

    const token = await signToken(sessionUser);
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    await setSessionCookie(token, isHttps);

    return NextResponse.json({ user: sessionUser });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
