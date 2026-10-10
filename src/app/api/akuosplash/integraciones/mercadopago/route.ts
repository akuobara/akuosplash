import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// PUT /api/akuosplash/integraciones/mercadopago
// Body: { accessToken?, publicKey?, clientId?, userId?, sandbox? }
// Solo superadmin. Guarda en AkuoConfig (DB). Si un campo viene vacío/undefined, no lo sobreescribe.
export async function PUT(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const body = await req.json();
  const data: any = {};
  if (typeof body.accessToken === "string" && body.accessToken.trim()) data.mpAccessToken = body.accessToken.trim();
  if (typeof body.publicKey === "string" && body.publicKey.trim()) data.mpPublicKey = body.publicKey.trim();
  if (typeof body.clientId === "string" && body.clientId.trim()) data.mpClientId = body.clientId.trim();
  if (typeof body.userId === "string" && body.userId.trim()) data.mpUserId = body.userId.trim();
  if (typeof body.sandbox === "boolean") data.mpSandbox = body.sandbox;

  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) {
    await akuosplashDb.akuoConfig.create({
      data: {
        ...data,
        // defaults
        comisionPorcentaje: 0,
        precioPlanPro: 15000,
        precioPlanEnterprise: 50000,
        maxVehiculosFree: 1,
        maxVehiculosPro: 5,
        maxVehiculosEnterprise: 999,
        activo: true,
        precioDinamicoHabilitado: false,
        mpSandbox: body.sandbox !== false,
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
