import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await ensureAkuoConfigColumns();
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!email || !password) return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });

    let rows: any[] = [];
    let sqlError = null;
    try {
      rows = await akuosplashDb.$queryRawUnsafe(
        `SELECT id, email, nombre, telefono, rol, activo, aprobado, banned, banRazon, passwordHash, plan FROM AkuoUsuario WHERE email = ? LIMIT 1`,
        email
      );
    } catch (e: any) {
      sqlError = e?.message || String(e);
    }

    if (sqlError) {
      return NextResponse.json({ error: "DB error", detail: sqlError, email_used: email }, { status: 500 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "User not found", email_used: email, rows_returned: rows?.length ?? -1 }, { status: 401 });
    }

    const usuario = rows[0];
    if (!usuario.passwordHash) {
      return NextResponse.json({ error: "No password set", user_email: usuario.email }, { status: 401 });
    }

    let valid = false;
    try {
      valid = await bcrypt.compare(password, usuario.passwordHash);
    } catch (e: any) {
      return NextResponse.json({ error: "bcrypt error", detail: e?.message, hash_prefix: String(usuario.passwordHash).substring(0, 10) }, { status: 500 });
    }

    if (!valid) {
      return NextResponse.json({ error: "Password mismatch", hash_prefix: String(usuario.passwordHash).substring(0, 10) }, { status: 401 });
    }

    if (!usuario.activo) return NextResponse.json({ error: "Tu cuenta está desactivada" }, { status: 403 });
    if (usuario.banned) return NextResponse.json({ error: `Tu cuenta está bloqueada: ${usuario.banRazon || "no especificado"}` }, { status: 403 });

    try {
      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoUsuario SET ultimoLoginEn = ? WHERE id = ?`,
        new Date().toISOString(), usuario.id
      );
    } catch {}

    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: usuario.id, email: usuario.email, telefono: usuario.telefono, nombre: usuario.nombre, rol: usuario.rol, aprobado: usuario.aprobado } });
  } catch (e: any) {
    console.error("[login] error:", e);
    return NextResponse.json({ error: "No se pudo iniciar sesión: " + (e?.message || "") }, { status: 500 });
  }
}
