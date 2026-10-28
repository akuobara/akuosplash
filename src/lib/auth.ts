import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

// ===== Tipos =====
export interface SessionUser {
  userId: string;
  email: string;
  nombre: string;
  role: "dueno" | "chofer" | "super_admin";
  duenoId: string | null; // si es chofer, apunta al dueño; si es dueño, es su propio id
}

// ===== Hash de contraseñas =====
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

// ===== JWT =====
// En producción, JWT_SECRET debe estar definido. En desarrollo, se permite un fallback.
const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (process.env.NODE_ENV === "production" && !JWT_SECRET_RAW) {
  console.error("FATAL: JWT_SECRET no está definido en producción. La aplicación no es segura.");
}
const SECRET = new TextEncoder().encode(
  JWT_SECRET_RAW || "aljibe-app-dev-secret-change-in-production"
);
const COOKIE_NAME = "aljibe-session";

export async function signToken(user: SessionUser): Promise<string> {
  return await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

// ===== Cookies de sesión =====
export async function setSessionCookie(token: string, isHttps: boolean = false) {
  const cookieStore = await cookies();
  // Si la request viene por HTTPS (preview/producción), usar SameSite=none + Secure
  // Si viene por HTTP (localhost dev), usar SameSite=lax sin Secure
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 días
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ===== Obtener sesión actual =====
// Lee el token de la cookie (el middleware se encarga de copiar el header Authorization a cookie)
// Verifica en DB que el usuario siga activo (cache de 60s para no saturar la DB).

// Cache simple en memoria: userId -> { activo, ts }
const activoCache = new Map<string, { activo: boolean; ts: number }>();
const ACTIVO_CACHE_TTL = 60_000; // 60 segundos

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Verificar en DB que el usuario siga activo (con cache corto)
  const now = Date.now();
  const cached = activoCache.get(payload.userId);
  if (cached && now - cached.ts < ACTIVO_CACHE_TTL) {
    if (!cached.activo) return null;
    return payload;
  }

  // Consultar DB
  try {
    const user = await db.usuario.findUnique({
      where: { id: payload.userId },
      select: { activo: true, role: true },
    });
    if (!user || !user.activo) {
      // NO cachear negativo: si el usuario es reactivado, podrá usar la app inmediatamente
      return null;
    }
    // Actualizar rol si cambió en DB (evita stale JWT)
    if (user.role !== payload.role) {
      // El rol cambió — invalidar sesión forzando re-login
      // NO cachear negativo para permitir re-login inmediato tras corrección
      return null;
    }
    // Súper admin: siempre permitir
    if (user.role === "super_admin") {
      activoCache.set(payload.userId, { activo: true, ts: now });
      return payload;
    }
    activoCache.set(payload.userId, { activo: true, ts: now });
    return payload;
  } catch {
    // Si la DB falla, permitir la sesión (fail-open para no bloquear todo)
    return payload;
  }
}

// ===== Helpers para APIs =====
// Devuelve el usuario autenticado o null
export async function getCurrentUser(): Promise<SessionUser | null> {
  return getSession();
}

// Verifica si el usuario actual es una cuenta de demostración.
// Las cuentas demo son read-only: no pueden crear/editar/eliminar nada.
// Cache de 60s para no saturar la DB en cada request de escritura.
const demoCache = new Map<string, { isDemo: boolean; ts: number }>();
const DEMO_CACHE_TTL = 60_000;

export async function isDemoUser(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const now = Date.now();
  const cached = demoCache.get(session.userId);
  if (cached && now - cached.ts < DEMO_CACHE_TTL) {
    return cached.isDemo;
  }

  try {
    const user = await db.usuario.findUnique({
      where: { id: session.userId },
      select: { isDemo: true },
    });
    const isDemo = user?.isDemo ?? false;
    demoCache.set(session.userId, { isDemo, ts: now });
    return isDemo;
  } catch {
    return false;
  }
}

// Helper para usar en endpoints de escritura: si el usuario es demo, devuelve
// error 403 inmediatamente. Si no, continúa.
export async function checkNotDemo(): Promise<{ blocked: boolean }> {
  const isDemo = await isDemoUser();
  if (isDemo) {
    return { blocked: true };
  }
  return { blocked: false };
}

// Devuelve el duenoId del usuario actual:
// - Si es dueño, su propio userId
// - Si es chofer, su duenoId
export async function getDuenoId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return session.role === "dueno" ? session.userId : session.duenoId;
}

// Devuelve el filtro WHERE para que cada usuario vea solo lo suyo:
// - Dueño: WHERE duenoId = su userId
// - Chofer: WHERE duenoId = su duenoId AND (choferId = su userId OR choferId IS NULL)
export async function getScopeFilter() {
  const session = await getSession();
  if (!session) return null;

  if (session.role === "dueno") {
    return {
      duenoId: session.userId,
    };
  }

  // Chofer: ve los datos de su dueño, pero solo los suyos donde aplique
  return {
    duenoId: session.duenoId,
  };
}

// Devuelve el ID del chofer actual (para registrar entregas/gastos/vueltas)
export async function getChoferId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  return session.role === "chofer" ? session.userId : session.userId; // el dueño también puede registrar cosas como "chofer" de sí mismo
}
