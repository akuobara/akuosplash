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
  // IMPORTANTE: usar `select` con solo los campos PRE-existentes en la DB de producción.
  // Si no, Prisma intenta SELECT todas las columnas (incluidas las nuevas como transbankBuyOrder, planActivoDesde)
  // y falla con "no such column" si las migraciones no se corrieron todavía.
  // Después de correr las migraciones (migrate-precio-dinamico + migrate-transbank-campos),
  // este select funciona igual y trae nulls en los campos nuevos (default en DB).
  const u = await akuosplashDb.akuoUsuario.findUnique({
    where: { id: s.userId },
    select: {
      id: true,
      email: true,
      nombre: true,
      telefono: true,
      direccion: true,
      comuna: true,
      lat: true,
      lng: true,
      rut: true,
      indicacionesAcceso: true,
      requiereClientePresente: true,
      usoAgua: true,
      saldo: true,
      zonaId: true,
      passwordHash: true,
      avatarUrl: true,
      rol: true,
      activo: true,
      aprobado: true,
      banned: true,
      banRazon: true,
      creadoEn: true,
      ultimoLoginEn: true,
      googleId: true,
      facebookId: true,
      // Datos fiscales
      rutEmpresa: true,
      razonSocial: true,
      direccionEmpresa: true,
      giro: true,
      // Datos del chofer (persona natural — separado de la empresa)
      licenciaConducirUrl: true,
      licenciaConducirAtrasUrl: true,
      permisoCircUrl: true,
      seguroUrl: true,
      revisonTecnicaUrl: true,
      // Datos del vehículo (para marketplace)
      capacidadVehiculoKg: true,
      patenteVehiculo: true,
      tipoVehiculo: true,
      // Fotos del vehículo
      fotoVehiculoFrenteUrl: true,
      fotoVehiculoAtrasUrl: true,
      fotoVehiculoIzquierdaUrl: true,
      fotoVehiculoDerechaUrl: true,
      // Estado de aprobación (manejado por superadmin)
      estadoAprobacion: true,
      estadoAprobacionNota: true,
      estadoAprobacionActualizadoEn: true,
      // Facturación SII
      facturacionPlataforma: true,
      facturacionApiKey: true,
      // Precios por litro del transportista (para clientes propios)
      precioEfectivoPorLitro: true,
      precioTransferenciaPorLitro: true,
      // MercadoPago OAuth (para split en marketplace)
      mpUserId: true,
      mpAccessToken: true,
      mpRefreshToken: true,
      mpTokenExpiresAt: true,
      mpConnectedAt: true,
      // Subscripción (campos nuevos — puede que no existan en DB si no se migró)
      plan: true,
      planActivoDesde: true,
      planActivoHasta: true,
      transbankBuyOrder: true,
      transbankTokenWs: true,
      transbankStatus: true,
      transbankAmount: true,
      transbankPlanSolicitado: true,
      transbankCiclo: true,
      transbankIniciadoEn: true,
      transbankAutorizadoEn: true,
      transbankAuthorizationCode: true,
    },
  }).catch((e: any) => {
    // Fallback defensivo: si la columna nueva no existe en DB, usar $queryRawUnsafe con solo campos básicos
    if (String(e?.message || "").includes("no such column") || String(e?.message || "").includes("does not exist")) {
      return akuosplashDb.$queryRawUnsafe(
        `SELECT id, email, nombre, telefono, direccion, comuna, lat, lng, rut, indicacionesAcceso,
                requiereClientePresente, usoAgua, saldo, zonaId, passwordHash, avatarUrl, rol,
                activo, aprobado, banned, banRazon, creadoEn, ultimoLoginEn, googleId, facebookId,
                rutEmpresa, razonSocial, direccionEmpresa, giro,
                licenciaConducirUrl, permisoCircUrl, seguroUrl,
                capacidadVehiculoKg, patenteVehiculo, tipoVehiculo,
                facturacionPlataforma, facturacionApiKey, plan
         FROM AkuoUsuario WHERE id = ?`,
        s.userId
      ).then((rows: unknown) => (Array.isArray(rows) ? (rows as any[])[0] || null : null));
    }
    throw e;
  });
  if (!u || !u.activo || u.banned) return null;
  return u;
}

export async function akuoNotificar(usuarioId: string, tipo: string, titulo: string, mensaje: string, link?: string) {
  try { await akuosplashDb.akuoNotificacion.create({ data: { usuarioId, tipo, titulo, mensaje, link } }); } catch (e) { console.error("Akuo notify:", e); }
}

export async function akuoAuditar(superadminId: string | null, accion: string, entidad?: string, entidadId?: string, detalles?: string, ip?: string) {
  try { await akuosplashDb.akuoAuditLog.create({ data: { superadminId, accion, entidad, entidadId, detalles, ip } }); } catch (e) { console.error("Akuo audit:", e); }
}
