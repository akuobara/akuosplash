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
    const requestedRole = body.role === "chofer" ? "chofer" : "dueno";

    // Al menos uno de los dos (email o teléfono) es obligatorio
    const hasEmail = email?.trim();
    const hasPhone = telefono?.trim();
    
    if (!nombre?.trim() || !password || (!hasEmail && !hasPhone)) {
      return NextResponse.json(
        { error: "Nombre, contraseña y email o teléfono son obligatorios" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 4 caracteres" },
        { status: 400 }
      );
    }

    // Normalizar teléfono: solo dígitos con + al inicio
    let telefonoNormalizado: string | null = null;
    if (hasPhone) {
      const digits = telefono.trim().replace(/\D/g, "");
      if (digits.length >= 8) {
        telefonoNormalizado = "+" + digits;
      }
    }

    // Email: si viene, normalizar; si no viene, generar uno ficticio basado en el teléfono
    let emailFinal: string;
    if (hasEmail) {
      emailFinal = email.trim().toLowerCase();
    } else if (telefonoNormalizado) {
      // Generar email ficticio basado en el teléfono para cumplir con el constraint UNIQUE
      emailFinal = `phone_${telefonoNormalizado.replace(/\D/g, "")}@aljibeapp.local`;
    } else {
      return NextResponse.json(
        { error: "Email o teléfono válido es obligatorio" },
        { status: 400 }
      );
    }

    try {
      const user = await db.$transaction(async (tx) => {
        // Verificar email único
        const existing = await tx.usuario.findUnique({ where: { email: emailFinal } });
        if (existing) {
          throw new Error("EMAIL_EXISTS");
        }

        // Verificar teléfono único si viene
        if (telefonoNormalizado) {
          const existingPhone = await tx.usuario.findFirst({ where: { telefono: telefonoNormalizado } });
          if (existingPhone) {
            throw new Error("PHONE_EXISTS");
          }
        }

        const userCount = await tx.usuario.count();
        const role = userCount === 0 ? "dueno" : (requestedRole === "chofer" ? "chofer" : "dueno");

        const newUser = await tx.usuario.create({
          data: {
            nombre: nombre.trim(),
            email: emailFinal,
            passwordHash: hashPassword(password),
            telefono: telefonoNormalizado,
            role,
            duenoId: null,
          },
        });

        // Crear configuración por defecto para este dueño
        if (role === "dueno") {
          await tx.configuracion.create({
            data: {
              duenoId: newUser.id,
              nombreDueno: newUser.nombre,
              nombreChofer: newUser.nombre,
            },
          });
        }

        return newUser;
      });

      // Firmar token y setear cookie (fuera de la transacción)
      const sessionUser = {
        userId: user.id,
        email: user.email,
        nombre: user.nombre,
        role: user.role as "dueno" | "chofer" | "super_admin",
        duenoId: null,
      };
      const token = await signToken(sessionUser);
      const isHttps = req.headers.get("x-forwarded-proto") === "https";
      await setSessionCookie(token, isHttps);

      return NextResponse.json({ user: sessionUser, token }, { status: 201 });
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_EXISTS") {
        return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
      }
      if (err instanceof Error && err.message === "PHONE_EXISTS") {
        return NextResponse.json({ error: "Teléfono ya registrado" }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
