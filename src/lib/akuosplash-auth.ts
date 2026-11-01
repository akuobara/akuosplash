import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { akuosplashDb } from "./akuosplash-db";
import { createClient } from "@libsql/client";

// Cliente libsql directo (bypass Prisma) — Prisma adapter falla con P2010 en raw queries
function getDirectClient() {
  const url = process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "";
  const isTurso = url.startsWith("libsql://");
  const authToken = isTurso ? process.env.DATABASE_AUTH_TOKEN : undefined;
  return createClient({ url, authToken });
}

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
  // Usar libsql directo (bypass Prisma) — Prisma adapter falla con P2010
  let u: any = null;
  try {
    const client = getDirectClient();
    const r = await client.execute({
      sql: `SELECT id, email, nombre, telefono, direccion, comuna, lat, lng, rut, indicacionesAcceso,
              requiereClientePresente, usoAgua, saldo, zonaId, passwordHash, avatarUrl, rol,
              activo, aprobado, banned, banRazon, creadoEn, ultimoLoginEn, googleId, facebookId,
              rutEmpresa, razonSocial, direccionEmpresa, giro,
              licenciaConducirUrl, licenciaConducirAtrasUrl, permisoCircUrl, seguroUrl, revisonTecnicaUrl,
              capacidadVehiculoKg, patenteVehiculo, tipoVehiculo,
              fotoVehiculoFrenteUrl, fotoVehiculoAtrasUrl, fotoVehiculoIzquierdaUrl, fotoVehiculoDerechaUrl,
              estadoAprobacion, estadoAprobacionNota, estadoAprobacionActualizadoEn,
              facturacionPlataforma, facturacionApiKey,
              precioEfectivoPorLitro, precioTransferenciaPorLitro,
              mpUserId, mpAccessToken, mpRefreshToken, mpTokenExpiresAt, mpConnectedAt,
              plan, planActivoDesde, planActivoHasta,
              transbankBuyOrder, transbankTokenWs, transbankStatus, transbankAmount,
              transbankPlanSolicitado, transbankCiclo, transbankIniciadoEn, transbankAutorizadoEn,
              transbankAuthorizationCode,
              verificado, verificadoEn, verificadoPor,
              mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo, mpSubStatus,
              mpSubIniciadoEn, mpSubAutorizadoEn, mpSubAmount,
              mpTestUserEmail, regionTrabajo, comunaTrabajo, localidadTrabajo
       FROM AkuoUsuario WHERE id = ?`,
      args: [s.userId]
    });
    u = r.rows[0] || null;
  } catch (e) {
    // Fallback con select mínimo
    try {
      const client = getDirectClient();
      const r = await client.execute({
        sql: `SELECT id, email, nombre, telefono, direccion, comuna, lat, lng, rut, rol,
                activo, aprobado, banned, plan, passwordHash, avatarUrl
         FROM AkuoUsuario WHERE id = ?`,
        args: [s.userId]
      });
      u = r.rows[0] || null;
    } catch (e2) {
      console.error("akuoGetCurrentUser fallback failed:", e2);
      return null;
    }
  }
  if (!u || !u.activo || u.banned) return null;
  return u;
}

export async function akuoNotificar(usuarioId: string, tipo: string, titulo: string, mensaje: string, link?: string) {
  try { await akuosplashDb.akuoNotificacion.create({ data: { usuarioId, tipo, titulo, mensaje, link } }); } catch (e) { console.error("Akuo notify:", e); }
}

export async function akuoAuditar(superadminId: string | null, accion: string, entidad?: string, entidadId?: string, detalles?: string, ip?: string) {
  try { await akuosplashDb.akuoAuditLog.create({ data: { superadminId, accion, entidad, entidadId, detalles, ip } }); } catch (e) { console.error("Akuo audit:", e); }
}
