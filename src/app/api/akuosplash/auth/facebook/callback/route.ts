import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie, akuoNotificar } from "@/lib/akuosplash-auth";
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, origin));
  if (error) return redirectTo(`/akuosplash?oauth_error=${error}`);
  if (!code) return redirectTo("/akuosplash?oauth_error=no_code");
  const appId = process.env.AKUO_FACEBOOK_APP_ID!;
  const appSecret = process.env.AKUO_FACEBOOK_APP_SECRET!;
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/akuosplash/auth/facebook/callback`;
  try {
    const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId); tokenUrl.searchParams.set("client_secret", appSecret); tokenUrl.searchParams.set("redirect_uri", redirectUri); tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl);
    if (!tokenRes.ok) return redirectTo("/akuosplash?oauth_error=token_exchange");
    const tokenData = await tokenRes.json();
    const userUrl = new URL("https://graph.facebook.com/v18.0/me");
    userUrl.searchParams.set("fields", "id,name,email,picture"); userUrl.searchParams.set("access_token", tokenData.access_token);
    const userRes = await fetch(userUrl);
    if (!userRes.ok) return redirectTo("/akuosplash?oauth_error=userinfo");
    const f = await userRes.json();
    if (!f.email) return redirectTo("/akuosplash?oauth_error=no_email");
    let usuario = await akuosplashDb.akuoUsuario.findFirst({ where: { OR: [{ facebookId: f.id }, { email: f.email.toLowerCase() }] } });
    if (!usuario) {
      const sa = await akuosplashDb.akuoUsuario.findFirst({ where: { rol: "superadmin" } });
      const rol = sa ? "cliente" : "superadmin";
      usuario = await akuosplashDb.akuoUsuario.create({ data: { email: f.email.toLowerCase(), nombre: f.name || "Usuario Facebook", avatarUrl: f.picture?.data?.url || null, facebookId: f.id, rol, aprobado: rol !== "transportista", plan: "free", vehiculosPermitidos: rol === "superadmin" ? 999 : 1 } });
      await akuoNotificar(usuario.id, "bienvenida", "¡Bienvenido a AkuoSplash!", `Hola ${usuario.nombre}, te registraste con Facebook.`, "/akuosplash");
    } else if (!usuario.facebookId) {
      usuario = await akuosplashDb.akuoUsuario.update({ where: { id: usuario.id }, data: { facebookId: f.id, avatarUrl: f.picture?.data?.url || usuario.avatarUrl } });
    }
    if (!usuario.activo || usuario.banned) return redirectTo("/akuosplash?oauth_error=banned");
    await akuosplashDb.akuoUsuario.update({ where: { id: usuario.id }, data: { ultimoLoginEn: new Date() } });
    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    const path = usuario.rol === "transportista" ? "/akuosplash/transportista" : usuario.rol === "superadmin" ? "/akuosplash/superadmin" : "/akuosplash/cliente";
    return redirectTo(path);
  } catch (e) { console.error("Facebook OAuth error:", e); return redirectTo("/akuosplash?oauth_error=exception"); }
}
