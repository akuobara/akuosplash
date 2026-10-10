import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

// GET /api/akuosplash/integraciones/estado
// Devuelve el estado de configuración de cada pasarela de pago (sin exponer secrets).
// Lee primero de AkuoConfig (DB), fallback a env vars.
// Solo superadmin.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const config = await akuosplashDb.akuoConfig.findFirst();

  // MercadoPago — DB primero, fallback a env vars
  const mpAccessToken = config?.mpAccessToken || process.env.AKUO_MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
  const mpPublicKey = config?.mpPublicKey || process.env.NEXT_PUBLIC_AKUO_MP_PUBLIC_KEY || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "";
  const mpClientId = config?.mpClientId || process.env.AKUO_MP_CLIENT_ID || process.env.MP_CLIENT_ID || "";
  const mpUserId = config?.mpUserId || process.env.AKUO_MP_USER_ID || process.env.MP_USER_ID || "";
  const mpSandbox = config?.mpSandbox ?? (process.env.AKUO_MP_SANDBOX !== "false");

  // Transbank — DB primero, fallback a env vars
  const tbCommerceCode = config?.transbankCommerceCode || process.env.TRANSBANK_COMMERCE_CODE || "";
  const tbApiKey = config?.transbankApiKey || process.env.TRANSBANK_API_KEY || "";
  const tbEnvironment = config?.transbankEnvironment || process.env.TRANSBANK_ENVIRONMENT || "";

  return NextResponse.json({
    mercadopago: {
      configured: !!(mpAccessToken && mpPublicKey),
      sandbox: mpSandbox,
      hasAccessToken: !!mpAccessToken,
      hasPublicKey: !!mpPublicKey,
      hasClientId: !!mpClientId,
      hasUserId: !!mpUserId,
    },
    transbank: {
      configured: !!(tbCommerceCode && tbApiKey),
      environment: tbEnvironment,
      hasCommerceCode: !!tbCommerceCode,
      hasApiKey: !!tbApiKey,
    },
  });
}

