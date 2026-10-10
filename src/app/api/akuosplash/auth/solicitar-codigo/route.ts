// POST /api/akuosplash/auth/solicitar-codigo
// Body: { email }
// Genera código de 6 dígitos, lo guarda (vence en 10 min), y en dev lo devuelve en la respuesta
import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";

function generarCodigo(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Debes indicar email" }, { status: 400 });
    }

    // Limitar tasa: máximo 5 códigos por hora por email
    const hace1h = new Date(Date.now() - 60 * 60 * 1000);
    const existentes = await akuosplashDb.akuoCodigoLogin.findMany({
      where: {
        email,
        creadoEn: { gte: hace1h },
      },
    });
    if (existentes.length >= 5) {
      return NextResponse.json(
        { error: "Demasiados intentos. Esperá una hora y probá de nuevo." },
        { status: 429 }
      );
    }

    const codigo = generarCodigo();
    const expira = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await akuosplashDb.akuoCodigoLogin.create({
      data: {
        email,
        codigo,
        expiraEn: expira,
      },
    });

    // En desarrollo, devolver el código directamente (en prod se enviaría por email)
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json({
      ok: true,
      // En prod esto NO se devolvería — se enviaría por email
      ...(isDev ? { _codigoDev: codigo, _mensajeDev: `Código generado (dev): ${codigo}` } : {}),
      expiraEn: expira.toISOString(),
    });
  } catch (e) {
    console.error("AkuoSplash solicitar-codigo error:", e);
    return NextResponse.json({ error: "No se pudo generar el código" }, { status: 500 });
  }
}
