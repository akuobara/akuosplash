import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";

// POST /api/auth/register
// Solo funciona si NO hay usuarios registrados (crea el primer dueño).
// Los choferes posteriores los crea el dueño desde /api/usuarios.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nombre, email, password, telefono } = body;

    if (!nombre?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { error: "Nombre, email y contraseña son obligatorios" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 4 caracteres" },
        { status: 400 }
      );
    }

    // Verificar si ya hay usuarios registrados — usar transacción para evitar race condition
    // que podría crear dos dueños si dos registros llegan simultáneamente.
    try {
      const user = await db.$transaction(async (tx) => {
        const userCount = await tx.usuario.count();
        if (userCount > 0) {
          throw new Error("ALREADY_REGISTERED");
        }

        // Verificar email único
        const existing = await tx.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
        if (existing) {
          throw new Error("EMAIL_EXISTS");
        }

        // Crear el primer usuario como dueño
        const newUser = await tx.usuario.create({
          data: {
            nombre: nombre.trim(),
            email: email.trim().toLowerCase(),
            passwordHash: hashPassword(password),
            telefono: telefono?.trim() || null,
            role: "dueno",
            duenoId: null,
          },
        });

        // Crear configuración por defecto para este dueño
        await tx.configuracion.create({
          data: {
            duenoId: newUser.id,
            nombreDueno: newUser.nombre,
            nombreChofer: newUser.nombre, // el dueño puede ser su propio chofer
          },
        });

        return newUser;
      });

      // Firmar token y setear cookie (fuera de la transacción)
      const sessionUser = {
        userId: user.id,
        email: user.email,
        nombre: user.nombre,
        role: "dueno" as const,
        duenoId: null,
      };
      const token = await signToken(sessionUser);
      const isHttps = req.headers.get("x-forwarded-proto") === "https";
      await setSessionCookie(token, isHttps);

      return NextResponse.json({ user: sessionUser, token }, { status: 201 });
    } catch (err) {
      if (err instanceof Error && err.message === "ALREADY_REGISTERED") {
        return NextResponse.json(
          { error: "Ya existe una cuenta registrada. Usa el login o pide al dueño que te agregue como chofer." },
          { status: 403 }
        );
      }
      if (err instanceof Error && err.message === "EMAIL_EXISTS") {
        return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
