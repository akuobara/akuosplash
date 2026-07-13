import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { recoveryTokens } from "../recuperar/route";

// POST /api/auth/reset
// Verifica el token y cambia la contraseña
export async function POST(req: NextRequest) {
  try {
    const { userId, token, newPassword } = await req.json();

    if (!userId || !token || !newPassword) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 4 caracteres" }, { status: 400 });
    }

    // Verificar token
    const stored = recoveryTokens.get(userId);
    if (!stored) {
      return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 });
    }

    if (stored.token !== token) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    if (new Date() > stored.expires) {
      recoveryTokens.delete(userId);
      return NextResponse.json({ error: "El código ha expirado. Solicita uno nuevo." }, { status: 400 });
    }

    // Cambiar contraseña
    const passwordHash = hashPassword(newPassword);
    await db.usuario.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Eliminar token usado
    recoveryTokens.delete(userId);

    return NextResponse.json({ ok: true, message: "Contraseña cambiada exitosamente" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
  }
}
