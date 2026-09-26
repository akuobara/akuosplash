// Bolsón — auth helpers (sesión por cookie firmada, igual estilo que Aljibe)
// Permite login con email+password o teléfono+código (SMS simulado en dev).
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { bolsonDb } from "./bolson-db";

const BOLSON_SESSION_COOKIE = "bolson_session";
const BOLSON_JWT_SECRET = process.env.BOLSON_JWT_SECRET || "bolson-secret-dev-cambiar-en-produccion-1234567890";

export interface BolsonSession {
  userId: string;
  rol: "cliente" | "transportista" | "superadmin";
  nombre: string;
  exp: number;
}

async function getKey(): Promise<Uint8Array> {
  return new TextEncoder().encode(BOLSON_JWT_SECRET);
}

export async function bolsonSignToken(payload: { userId: string; rol: string; nombre: string }): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(await getKey());
}

export async function bolsonVerifyToken(token: string): Promise<BolsonSession | null> {
  try {
    const { payload } = await jwtVerify(token, await getKey());
    return {
      userId: payload.userId as string,
      rol: payload.rol as BolsonSession["rol"],
      nombre: payload.nombre as string,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function bolsonGetSession(): Promise<BolsonSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(BOLSON_SESSION_COOKIE)?.value;
  if (!token) return null;
  return await bolsonVerifyToken(token);
}

export async function bolsonSetSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  (await cookies()).set(BOLSON_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
}

export async function bolsonClearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  (await cookies()).delete(BOLSON_SESSION_COOKIE);
}

// === HELPERS DE USUARIO ===

export async function bolsonGetCurrentUser() {
  const session = await bolsonGetSession();
  if (!session) return null;
  const user = await bolsonDb.bolsonUsuario.findUnique({
    where: { id: session.userId },
    include: {
      comisionesConfig: true,
    },
  });
  if (!user || !user.activo || user.banned) return null;
  return user;
}

export async function bolsonRequireAuth(rolesPermitidos: Array<"cliente" | "transportista" | "superadmin"> = ["cliente", "transportista", "superadmin"]) {
  const user = await bolsonGetCurrentUser();
  if (!user) {
    return { error: { status: 401, message: "No autenticado" }, user: null, session: null };
  }
  if (!rolesPermitidos.includes(user.rol as any)) {
    return { error: { status: 403, message: "No tenés permiso para esta acción" }, user: null, session: null };
  }
  return { error: null, user, session: { userId: user.id, rol: user.rol as any, nombre: user.nombre, exp: 0 } };
}

// === HELPERS DE NOTIFICACIONES ===

export async function bolsonNotificar(usuarioId: string, tipo: string, titulo: string, mensaje: string, link?: string, solicitudId?: string) {
  try {
    await bolsonDb.bolsonNotificacion.create({
      data: {
        usuarioId,
        tipo,
        titulo,
        mensaje,
        link,
        solicitudId,
      },
    });
  } catch (e) {
    console.error("Bolson: no se pudo crear notificación:", e);
  }
}
