import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.cl";

// GET /api/akuosplash/auth/mp/oauth
// Inicia el flujo OAuth de MercadoPago Marketplace
// El repartidor es redirigido a MP para autorizar a la app a cobrar/dividir pagos en su nombre
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas pueden conectar su cuenta MP" }, { status: 403 });
  }

  const clientId = process.env.AKUO_MP_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "AKUO_MP_CLIENT_ID no configurado" }, { status: 500 });
  }

  // Redirect URI de callback (vuelve a nuestro sitio)
  const redirectUri = `${APP_URL}/api/akuosplash/auth/mp/oauth/callback`;
  // State para CSRF: usamos el userId del repartidor
  const state = user.id;

  const mpAuthUrl = `https://auth.mercadopago.cl/authorization?client_id=${clientId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  return NextResponse.redirect(mpAuthUrl);
}
