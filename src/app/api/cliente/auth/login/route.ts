import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPasswordCliente, signTokenCliente, setSessionCookieCliente } from "@/lib/auth-cliente";

// POST /api/cliente/auth/login
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.email?.trim() || !body.password) {
      return NextResponse.json({ error: "Email y contraseña son obligatorios" }, { status: 400 });
    }

    const emailNorm = body.email.trim().toLowerCase();
    const cliente = await db.clienteApp.findUnique({ where: { email: emailNorm } });
    if (!cliente || !cliente.passwordHash) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }
    if (!cliente.activo) {
      return NextResponse.json({ error: "Tu cuenta está desactivada." }, { status: 403 });
    }
    if (!verifyPasswordCliente(String(body.password), cliente.passwordHash)) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    const token = await signTokenCliente({
      clienteId: cliente.id,
      email: emailNorm,
      nombre: cliente.nombre,
      duenoId: cliente.proveedorPreferidoId || "",
    });
    await setSessionCookieCliente(token, isHttps);

    return NextResponse.json({
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email,
        saldo: cliente.saldo,
      },
      token,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo iniciar sesión" }, { status: 500 });
  }
}
