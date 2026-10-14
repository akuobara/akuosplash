import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie, akuoNotificar } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
export async function GET(req: NextRequest) {
  // Asegurar que las columnas nuevas existan antes de cualquier query
  await ensureAkuoConfigColumns();
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

    // Leer el rol deseado del state (ej: "akuosplash-google-transportista")
    const stateParam = searchParams.get("state") || "akuosplash-google";
    const rolDeseado = stateParam.replace("akuosplash-google-", "");
    const quiereSerTransportista = rolDeseado === "transportista";

    // Usar select con solo campos existentes para evitar errores de columnas nuevas
    const selectFields = {
      id: true, email: true, nombre: true, telefono: true, rol: true,
      activo: true, aprobado: true, banned: true, banRazon: true,
      googleId: true, avatarUrl: true, plan: true,
      rut: true, direccion: true, comuna: true, lat: true, lng: true,
      zonaId: true,
    };

    let usuario = await akuosplashDb.akuoUsuario.findFirst({
      where: { OR: [{ googleId: g.id }, { email: g.email.toLowerCase() }] },
      select: selectFields,
    }).catch(() => null);

    let isNewClient = false;

    if (!usuario) {
      // Crear usuario nuevo
      const sa = await akuosplashDb.akuoUsuario.findFirst({ where: { rol: "superadmin" } });
      // Si no hay superadmin, el primero es superadmin
      // Si hay superadmin, usar el rol deseado (cliente o transportista)
      const rol: string = sa ? (quiereSerTransportista ? "transportista" : "cliente") : "superadmin";
      usuario = await akuosplashDb.akuoUsuario.create({
        data: {
          email: g.email.toLowerCase(), nombre: g.name || "Usuario Google",
          avatarUrl: g.picture || null, googleId: g.id, rol,
          aprobado: true, plan: "free",
          vehiculosPermitidos: rol === "superadmin" ? 999 : 1,
        },
        select: selectFields,
      });
      isNewClient = true;
      await akuoNotificar(usuario.id, "bienvenida", "¡Bienvenido a AkuoSplash!", `Hola ${usuario.nombre}, te registraste con Google.`, "/akuosplash");
    } else if (quiereSerTransportista && usuario.rol === "cliente") {
      // El usuario ya existe como cliente pero quiere ser transportista — upgrade
      usuario = await akuosplashDb.akuoUsuario.update({
        where: { id: usuario.id },
        data: {
          rol: "transportista",
          googleId: g.id,
          avatarUrl: g.picture || usuario.avatarUrl,
        },
        select: selectFields,
      }).catch(() => usuario);
      isNewClient = true; // Tratar como nuevo para que complete perfil de transportista
    } else if (!usuario.googleId) {
      // Vincular Google a cuenta existente
      usuario = await akuosplashDb.akuoUsuario.update({
        where: { id: usuario.id },
        data: { googleId: g.id, avatarUrl: g.picture || usuario.avatarUrl },
        select: selectFields,
      }).catch(() => usuario);
    }

    if (!usuario || !usuario.activo || usuario.banned) return redirectTo("/akuosplash?oauth_error=banned");

    await akuosplashDb.akuoUsuario.update({ where: { id: usuario.id }, data: { ultimoLoginEn: new Date() } }).catch(() => {});
    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);

    // Si es cliente nuevo (sin RUT ni zona), mandar al perfil para completar
    if (isNewClient && usuario.rol === "cliente" && (!usuario.rut || !usuario.zonaId)) {
      return redirectTo("/akuosplash/cliente?incompleto=1");
    }

    const path = usuario.rol === "transportista" ? "/akuosplash/transportista" : usuario.rol === "superadmin" ? "/akuosplash/superadmin" : "/akuosplash/cliente";
    return redirectTo(path);
  } catch (e: any) {
    console.error("Google OAuth error:", e?.message || String(e));
    console.error("Stack:", e?.stack);
    // Redirigir con mensaje más específico
    const errMsg = encodeURIComponent(e?.message || "exception");
    return redirectTo(`/akuosplash?oauth_error=${errMsg}`);
  }
}
