import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

// ===== Hash de contraseñas (mismo algoritmo que auth.ts principal) =====
export function hashPasswordCliente(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPasswordCliente(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(verifyHash, "hex"));
  } catch {
    return false;
  }
}

// ===== JWT para clientes =====
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "aljibe-app-dev-secret-change-in-production"
);
const COOKIE_NAME = "aljibe-cliente-session";

export interface ClienteSession {
  clienteId: string;
  email: string;
  nombre: string;
  duenoId: string; // el admin al que está vinculado
}

export async function signTokenCliente(cliente: ClienteSession): Promise<string> {
  return await new SignJWT({ ...cliente, tipo: "cliente" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifyTokenCliente(token: string): Promise<ClienteSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.tipo !== "cliente") return null;
    return {
      clienteId: payload.clienteId as string,
      email: payload.email as string,
      nombre: payload.nombre as string,
      duenoId: payload.duenoId as string,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookieCliente(token: string, isHttps: boolean = false) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearSessionCookieCliente() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ===== Helper para leer sesión del cliente =====
export async function getClienteSession(): Promise<ClienteSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifyTokenCliente(token);
}
