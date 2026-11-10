import { NextRequest, NextResponse } from "next/server";
import { akuoSignToken, akuoSetSessionCookie } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
import crypto from "node:crypto";

export async function POST(req: NextRequest) {
  try {
    await ensureAkuoConfigColumns();
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !password) return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });

    // Usar libsql directo (Prisma findUnique falla en Render)
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    const r = await client.execute({
      sql: "SELECT id, email, nombre, telefono, rol, activo, aprobado, banned, banRazon, passwordHash, plan FROM AkuoUsuario WHERE email = ? LIMIT 1",
      args: [email],
    });

    if (r.rows.length === 0) {
      return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    const usuario = r.rows[0] as any;
    if (!usuario.passwordHash) {
      return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    // Verificar password — soporta scrypt (salt:hash) y bcrypt ($2...)
    let valid = false;
    const hashStr = String(usuario.passwordHash);

    // Intentar scrypt primero (formato salt:hash)
    try {
      if (hashStr.includes(":") && !hashStr.startsWith("$2")) {
        const [salt, hash] = hashStr.split(":");
        if (salt && hash) {
          const verifyHash = crypto.scryptSync(password, salt, 64).toString("hex");
          valid = verifyHash === hash;
        }
      }
    } catch {}

    // Fallback: bcrypt
    if (!valid) {
      try {
        const bcrypt = await import("bcryptjs");
        valid = await bcrypt.compare(password, hashStr);
      } catch {}
    }

    if (!valid) return NextResponse.json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    if (!usuario.activo) return NextResponse.json({ error: "Tu cuenta está desactivada" }, { status: 403 });
    if (usuario.banned) return NextResponse.json({ error: `Tu cuenta está bloqueada: ${usuario.banRazon || "no especificado"}` }, { status: 403 });

    // Actualizar ultimoLoginEn
    try {
      await client.execute({
        sql: "UPDATE AkuoUsuario SET ultimoLoginEn = ? WHERE id = ?",
        args: [new Date().toISOString(), usuario.id],
      });
    } catch {}

    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: usuario.id, email: usuario.email, telefono: usuario.telefono, nombre: usuario.nombre, rol: usuario.rol, aprobado: usuario.aprobado } });
  } catch (e) {
    console.error("Akuo login:", e);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
