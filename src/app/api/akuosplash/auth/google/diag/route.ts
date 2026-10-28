import { NextResponse } from "next/server";

// GET /api/akuosplash/auth/google/diag
// Diagnóstico de la configuración de Google OAuth (sin revelar secrets)
export async function GET(req: Request) {
  const clientId = process.env.AKUO_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AKUO_GOOGLE_CLIENT_SECRET;
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "unknown";

  return NextResponse.json({
    hasClientId: !!clientId,
    clientIdLength: clientId?.length || 0,
    clientIdPrefix: clientId ? clientId.substring(0, 20) + "..." : "MISSING",
    hasClientSecret: !!clientSecret,
    clientSecretLength: clientSecret?.length || 0,
    redirectUri: `${protocol}://${host}/api/akuosplash/auth/google/callback`,
    host,
    protocol,
    note: "Verificá que el redirectUri de arriba esté autorizado en Google Cloud Console → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs",
  });
}
