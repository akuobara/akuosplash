import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PUT /api/akuosplash/integraciones/transbank
// Body: { commerceCode?, apiKey?, environment? }
// Solo superadmin.
export async function PUT(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};
  if (typeof body.commerceCode === "string" && body.commerceCode.trim()) data.transbankCommerceCode = body.commerceCode.trim();
  if (typeof body.apiKey === "string" && body.apiKey.trim()) data.transbankApiKey = body.apiKey.trim();
  if (typeof body.environment === "string" && (body.environment === "INTEGRACION" || body.environment === "PRODUCCION")) {
    data.transbankEnvironment = body.environment;
  }

  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) {
    await akuosplashDb.akuoConfig.create({
      data: {
        ...data,
        comisionPorcentaje: 0,
        precioPlanPro: 15000,
        precioPlanEnterprise: 50000,
        maxVehiculosFree: 1,
        maxVehiculosPro: 5,
        maxVehiculosEnterprise: 999,
        activo: true,
        precioDinamicoHabilitado: false,
        mpSandbox: true,
        transbankEnvironment: data.transbankEnvironment || "INTEGRACION",
      },
    });
  } else {
    await akuosplashDb.akuoConfig.update({
      where: { id: config.id },
      data,
    });
  }

  return NextResponse.json({ ok: true });
}
