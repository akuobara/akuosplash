import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.cl";

// GET /api/akuosplash/auth/mp/oauth/callback?code=...&state=USER_ID
// Recibe el callback de MP después de que el repartidor autoriza
// Intercambia el code por access_token y refresh_token
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // userId del repartidor
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/akuosplash/transportista?mp_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${APP_URL}/akuosplash/transportista?mp_error=no_code_or_state`);
  }

  const clientId = process.env.AKUO_MP_CLIENT_ID;
  const clientSecret = process.env.AKUO_MP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${APP_URL}/akuosplash/transportista?mp_error=no_mp_credentials`);
  }

  const redirectUri = `${APP_URL}/api/akuosplash/auth/mp/oauth/callback`;

  try {
    // Intercambiar code por tokens
    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("MP OAuth token error:", errText);
      return NextResponse.redirect(`${APP_URL}/akuosplash/transportista?mp_error=token_exchange_failed`);
    }

    const tokens = await tokenRes.json();
    // tokens: { access_token, refresh_token, public_key, user_id, token_type, expires_in, scope }

    // Guardar tokens en el usuario repartidor
    await akuosplashDb.akuoUsuario.update({
      where: { id: state },
      data: {
        mpAccessToken: tokens.access_token,
        mpRefreshToken: tokens.refresh_token,
        mpUserId: String(tokens.user_id),
        mpTokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 21600) * 1000),
        mpConnectedAt: new Date(),
      },
    });

    return NextResponse.redirect(`${APP_URL}/akuosplash/transportista?mp_connected=1`);
  } catch (e: any) {
    console.error("MP OAuth callback error:", e);
    return NextResponse.redirect(`${APP_URL}/akuosplash/transportista?mp_error=exception`);
  }
}
