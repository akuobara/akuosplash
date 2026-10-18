import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/integraciones/estado
// Devuelve el estado de configuración de cada pasarela de pago (sin exponer secrets).
// 2 cuentas MP:
//   - mpSplit: para pagos del marketplace (cliente paga por agua, con split entre plataforma y transportista)
//   - mpSub: para subscripciones de planes (transportista paga por su plan mensual/anual)
// Lee primero de AkuoConfig (DB), fallback a env vars.
// Solo superadmin.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  await ensureAkuoConfigColumns();
  // Leer con raw SQL para evitar Prisma errors si hay columnas legacy no migradas
  let row: any = null;
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT
        mpSplitAccessToken, mpSplitPublicKey, mpSplitUserId,
        mpSubAccessToken, mpSubPublicKey,
        mpAccessToken, mpPublicKey, mpClientId, mpUserId, mpSandbox,
        transbankCommerceCode, transbankApiKey, transbankEnvironment
       FROM AkuoConfig WHERE activo = 1 LIMIT 1`
    );
    if (Array.isArray(result) && result.length > 0) row = result[0];
  } catch (e: any) {
    console.warn("[integraciones/estado] SQL failed:", e?.message);
  }

  // MP Split (marketplace — cliente paga)
  const splitAccessToken = row?.mpSplitAccessToken || process.env.AKUO_MP_SPLIT_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || "";
  const splitPublicKey = row?.mpSplitPublicKey || process.env.AKUO_MP_SPLIT_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || "";
  const splitUserId = row?.mpSplitUserId || process.env.AKUO_MP_SPLIT_USER_ID || process.env.AKUO_MP_USER_ID || "";

  // MP Subscriptions (transportista paga por plan)
  const subAccessToken = row?.mpSubAccessToken || process.env.AKUO_MP_SUB_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || "";
  const subPublicKey = row?.mpSubPublicKey || process.env.AKUO_MP_SUB_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || "";

  // Legacy fields (mantenidos para backward compat — ya no se usan)
  const legacyAccessToken = row?.mpAccessToken || process.env.AKUO_MP_ACCESS_TOKEN || "";
  const legacyPublicKey = row?.mpPublicKey || process.env.AKUO_MP_PUBLIC_KEY || "";
  const legacyClientId = row?.mpClientId || process.env.AKUO_MP_CLIENT_ID || "";
  const legacyUserId = row?.mpUserId || process.env.AKUO_MP_USER_ID || "";
  const mpSandbox = row?.mpSandbox ?? (process.env.AKUO_MP_SANDBOX !== "false");

  // Transbank (legacy — para subscripciones antes de MP)
  const tbCommerceCode = row?.transbankCommerceCode || process.env.TRANSBANK_COMMERCE_CODE || "";
  const tbApiKey = row?.transbankApiKey || process.env.TRANSBANK_API_KEY || "";
  const tbEnvironment = row?.transbankEnvironment || process.env.TRANSBANK_ENVIRONMENT || "";

  return NextResponse.json({
    mpSplit: {
      configured: !!(splitAccessToken && splitPublicKey),
      hasAccessToken: !!splitAccessToken,
      hasPublicKey: !!splitPublicKey,
      hasUserId: !!splitUserId,
    },
    mpSub: {
      configured: !!(subAccessToken && subPublicKey),
      hasAccessToken: !!subAccessToken,
      hasPublicKey: !!subPublicKey,
    },
    // Legacy — ya no se usa activamente pero se muestra por compat
    mercadopago: {
      configured: !!(legacyAccessToken && legacyPublicKey),
      sandbox: mpSandbox,
      hasAccessToken: !!legacyAccessToken,
      hasPublicKey: !!legacyPublicKey,
      hasClientId: !!legacyClientId,
      hasUserId: !!legacyUserId,
    },
    transbank: {
      configured: !!(tbCommerceCode && tbApiKey),
      environment: tbEnvironment,
      hasCommerceCode: !!tbCommerceCode,
      hasApiKey: !!tbApiKey,
    },
  });
}
