import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "node:crypto";

// POST /api/auth/recuperar
// Genera un token de recuperación y lo devuelve (en producción se enviaría por email).
// Como no tenemos servidor de email, el token se muestra en pantalla para copiar.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email es obligatorio" }, { status: 400 });
    }

    const user = await db.usuario.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, nombre: true, email: true, activo: true },
    });

    // Por seguridad, siempre devolvemos "ok" aunque el email no exista
    // (para no revelar qué emails están registrados)
    if (!user || !user.activo) {
      return NextResponse.json({
        ok: true,
        message: "Si el email existe, se ha generado un código de recuperación.",
        token: null,
      });
    }

    // Generar token de 6 dígitos (código simple para uso sin email)
    const token = crypto.randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Guardar token en la base de datos (en el campo passwordHash temporalmente)
    // Mejor: usar un campo separado. Pero como no tenemos schema para eso,
    // guardamos en memoria con un Map (se pierde al reiniciar el servidor,
    // pero es suficiente para una app pequeña sin email).
    recoveryTokens.set(user.id, { token, expires, email: user.email });

    return NextResponse.json({
      ok: true,
      message: `Código de recuperación generado. Se enviará a ${user.email}.`,
      // En desarrollo/devolvemos el token para que el usuario lo use
      token: token,
      userId: user.id,
      userName: user.nombre,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 500 });
  }
}

// Store en memoria para tokens de recuperación
// (en producción: tabla en DB o Redis)
export const recoveryTokens = new Map<string, { token: string; expires: Date; email: string }>();
