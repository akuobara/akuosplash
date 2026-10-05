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
  const clientId = process.env.AKUO_GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.AKUO_GOOGLE_CLIENT_SECRET!;
  const protocol = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const redirectUri = `${protocol}://${host}/api/akuosplash/auth/google/callback`;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
    if (!tokenRes.ok) { console.error("Google token failed:", await tokenRes.text()); return redirectTo("/akuosplash?oauth_error=token_exchange"); }
    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    if (!userRes.ok) return redirectTo("/akuosplash?oauth_error=userinfo");
    const g = await userRes.json();
    let usuario = await akuosplashDb.akuoUsuario.findFirst({ where: { OR: [{ googleId: g.id }, { email: g.email.toLowerCase() }] } });
    if (!usuario) {
      const sa = await akuosplashDb.akuoUsuario.findFirst({ where: { rol: "superadmin" } });
      const rol = sa ? "cliente" : "superadmin";
      usuario = await akuosplashDb.akuoUsuario.create({ data: { email: g.email.toLowerCase(), nombre: g.name || "Usuario Google", avatarUrl: g.picture || null, googleId: g.id, rol, aprobado: rol !== "transportista", plan: "free", vehiculosPermitidos: rol === "superadmin" ? 999 : 1 } });
      await akuoNotificar(usuario.id, "bienvenida", "¡Bienvenido a AkuoSplash!", `Hola ${usuario.nombre}, te registraste con Google.`, "/akuosplash");
    } else if (!usuario.googleId) {
      usuario = await akuosplashDb.akuoUsuario.update({ where: { id: usuario.id }, data: { googleId: g.id, avatarUrl: g.picture || usuario.avatarUrl } });
    }
    if (!usuario.activo || usuario.banned) return redirectTo("/akuosplash?oauth_error=banned");
    await akuosplashDb.akuoUsuario.update({ where: { id: usuario.id }, data: { ultimoLoginEn: new Date() } });
    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    const path = usuario.rol === "transportista" ? "/akuosplash/transportista" : usuario.rol === "superadmin" ? "/akuosplash/superadmin" : "/akuosplash/cliente";
    return redirectTo(path);
  } catch (e) { console.error("Google OAuth error:", e); return redirectTo("/akuosplash?oauth_error=exception"); }
}
