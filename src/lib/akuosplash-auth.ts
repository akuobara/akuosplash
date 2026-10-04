import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { akuosplashDb } from "./akuosplash-db";

const COOKIE = "akuosplash_session";
const SECRET = process.env.AKUOSPLASH_JWT_SECRET || "akuosplash-secret-dev-cambiar-en-produccion-1234567890";

export interface AkuoSession { userId: string; rol: string; nombre: string; exp: number; }

async function getKey() { return new TextEncoder().encode(SECRET); }

export async function akuoSignToken(p: { userId: string; rol: string; nombre: string }) {
  return await new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(await getKey());
}

export async function akuoVerifyToken(token: string): Promise<AkuoSession | null> {
  try { const { payload } = await jwtVerify(token, await getKey()); return { userId: payload.userId as string, rol: payload.rol as string, nombre: payload.nombre as string, exp: payload.exp as number }; } catch { return null; }
}

export async function akuoGetSession() {
  const c = await cookies(); const t = c.get(COOKIE)?.value; if (!t) return null; return akuoVerifyToken(t);
}

export async function akuoSetSessionCookie(token: string) {
  const c = await cookies(); c.set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export async function akuoClearSessionCookie() { const c = await cookies(); c.delete(COOKIE); }

export async function akuoGetCurrentUser() {
  const s = await akuoGetSession(); if (!s) return null;
  const u = await akuosplashDb.akuoUsuario.findUnique({ where: { id: s.userId } });
  if (!u || !u.activo || u.banned) return null; return u;
}

export async function akuoNotificar(usuarioId: string, tipo: string, titulo: string, mensaje: string, link?: string) {
  try { await akuosplashDb.akuoNotificacion.create({ data: { usuarioId, tipo, titulo, mensaje, link } }); } catch (e) { console.error("Akuo notify:", e); }
}

export async function akuoAuditar(superadminId: string | null, accion: string, entidad?: string, entidadId?: string, detalles?: string, ip?: string) {
  try { await akuosplashDb.akuoAuditLog.create({ data: { superadminId, accion, entidad, entidadId, detalles, ip } }); } catch (e) { console.error("Akuo audit:", e); }
}
