// POST /api/akuosplash/transportista/suscripcion
// Body: { plan: "free" | "pro" | "enterprise" }
// Activa una suscripción (simulado — en prod iría a WebPay/MercadoPago).
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const plan = body.plan;
    if (!["free", "pro", "enterprise"].includes(plan)) {
      return NextResponse.json({ error: "Plan inválido" }, { status: 400 });
    }

    const config = await akuosplashDb.akuoConfig.findFirst();
    const precios: Record<string, number> = {
      free: 0,
      pro: config.precioPlanPro,
      enterprise: config.precioPlanEnterprise,
    };
    const vehiculosPermitidos: Record<string, number> = {
      free: config.maxVehiculosFree,
      pro: config.maxVehiculosPro,
      enterprise: config.maxVehiculosEnterprise,
    };
    const monto = precios[plan];

    // Crear registro de suscripción
    const inicio = new Date();
    const fin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
    await akuosplashDb.akuoSuscripcion.create({
      data: {
        transportistaId: user.id,
        plan,
        monto,
        periodoDias: 30,
        inicio,
        fin,
        estado: monto === 0 ? "activa" : "activa", // simulado: siempre activa
        metodoPago: "webpay",
        referencia: `simulado-${Date.now()}`,
      },
    });

    // Actualizar usuario
    const actualizado = await akuosplashDb.akuoUsuario.update({
      where: { id: user.id },
      data: {
        plan,
        suscripcionActiva: true,
        suscripcionInicio: inicio,
        suscripcionFin: fin,
        vehiculosPermitidos: vehiculosPermitidos[plan],
      },
    });

    return NextResponse.json({
      ok: true,
      plan: actualizado.plan,
      suscripcionActiva: actualizado.suscripcionActiva,
      vehiculosPermitidos: actualizado.vehiculosPermitidos,
      suscripcionFin: actualizado.suscripcionFin,
    });
  } catch (e) {
    console.error("AkuoSplash transportista/suscripcion POST error:", e);
    return NextResponse.json({ error: "No se pudo activar la suscripción" }, { status: 500 });
  }
}
