import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/cliente/auth/recuperar
// Recibe email, genera token de reset, guarda en DB
// Por ahora no envía email (falta configurar SMTP), pero genera el token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email es obligatorio" }, { status: 400 });
    }

    const cliente = await db.clienteApp.findUnique({ where: { email } });

    if (!cliente) {
      // Por seguridad, no revelar si el email existe
      return NextResponse.json({ ok: true });
    }

    // Generar token aleatorio
    const crypto = require("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    const expiracion = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar token en el cliente (usamos el campo nota temporalmente)
    // TODO: crear tabla ResetToken cuando se implemente SMTP
    await db.clienteApp.update({
      where: { id: cliente.id },
      data: { nota: `RESET_TOKEN:${token}:${expiracion.toISOString()}` },
    });

    // TODO: enviar email con link /cliente/reset?token=xxx
    // Por ahora, devolver el token para testing
    return NextResponse.json({
      ok: true,
      // Solo en desarrollo: devolver el token
      token: process.env.NODE_ENV === "production" ? undefined : token,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo procesar" }, { status: 500 });
  }
}
