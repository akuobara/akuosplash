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

  // MP Default (legacy / Plan Gratis sin split)
  const mpAccessToken = config?.mpAccessToken || process.env.AKUO_MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "";
  const mpPublicKey = config?.mpPublicKey || process.env.NEXT_PUBLIC_AKUO_MP_PUBLIC_KEY || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "";
  const mpClientId = config?.mpClientId || process.env.AKUO_MP_CLIENT_ID || process.env.MP_CLIENT_ID || "";
  const mpUserId = config?.mpUserId || process.env.AKUO_MP_USER_ID || process.env.MP_USER_ID || "";
  const mpSandbox = config?.mpSandbox ?? (process.env.AKUO_MP_SANDBOX !== "false");

  // MP Instant (Plan Pro — pago inmediato)
  const mpInstAccessToken = config?.mpInstantAccessToken || process.env.AKUO_MP_INSTANT_ACCESS_TOKEN || "";
  const mpInstPublicKey = config?.mpInstantPublicKey || process.env.AKUO_MP_INSTANT_PUBLIC_KEY || "";
  const mpInstUserId = config?.mpInstantUserId || process.env.AKUO_MP_INSTANT_USER_ID || "";

  // MP 10day (Plan Premium — pago diferido 10 días)
  const mp10AccessToken = config?.mp10dayAccessToken || process.env.AKUO_MP_10DAY_ACCESS_TOKEN || "";
  const mp10PublicKey = config?.mp10dayPublicKey || process.env.AKUO_MP_10DAY_PUBLIC_KEY || "";
  const mp10UserId = config?.mp10dayUserId || process.env.AKUO_MP_10DAY_USER_ID || "";

  // Transbank (legacy subscriptions)
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
    mpInstant: {
      configured: !!(mpInstAccessToken && mpInstPublicKey),
      hasAccessToken: !!mpInstAccessToken,
      hasPublicKey: !!mpInstPublicKey,
      hasUserId: !!mpInstUserId,
    },
    mp10day: {
      configured: !!(mp10AccessToken && mp10PublicKey),
      hasAccessToken: !!mp10AccessToken,
      hasPublicKey: !!mp10PublicKey,
      hasUserId: !!mp10UserId,
    },
    transbank: {
      configured: !!(tbCommerceCode && tbApiKey),
      environment: tbEnvironment,
      hasCommerceCode: !!tbCommerceCode,
      hasApiKey: !!tbApiKey,
    },
  });
}
