import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/auth";
import { createRemoteJWKSet, jwtVerify } from "jose";

// POST /api/auth/google
// Recibe { credential } que es el ID token JWT de Google Identity Services.
// Lo verifica contra las claves públicas de Google, extrae email/nombre,
// y crea/find usuario + sesión.
//
// Reglas:
// - Si no hay usuarios en la DB, crea el primero como dueño (igual que el register normal).
// - Si ya hay usuarios:
//   - Si el email coincide con un usuario existente, inicia sesión.
//   - Si no coincide, rechaza con error (no se permiten registros espontáneos via Google
//     — el dueño debe crear la cuenta primero desde Equipo, o usar register normal).

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/cert")
);

interface GooglePayload {
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
}

export async function POST(req: NextRequest) {
  // Verificar que Google login esté configurado
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: "Google Sign-In no está configurado. El dueño debe configurar GOOGLE_CLIENT_ID." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const credential = body.credential;

    if (!credential || typeof credential !== "string") {
      return NextResponse.json({ error: "Falta el token de Google" }, { status: 400 });
    }

    // Verificar el ID token de Google usando jose + JWKS remoto
    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const googleData = payload as unknown as GooglePayload;

    if (!googleData.email) {
      return NextResponse.json({ error: "El token de Google no contiene email" }, { status: 400 });
    }

    if (googleData.email_verified === false) {
      return NextResponse.json({ error: "Email de Google no verificado" }, { status: 400 });
    }

    const email = googleData.email.toLowerCase().trim();

    // Buscar usuario existente por email
    let user = await db.usuario.findUnique({ where: { email } });

    // Si no existe y no hay usuarios, crear como primer dueño (transaccional para evitar race)
    if (!user) {
      try {
        user = await db.$transaction(async (tx) => {
          const userCount = await tx.usuario.count();
          if (userCount > 0) {
            throw new Error("ALREADY_HAS_USERS");
          }
          const existing = await tx.usuario.findUnique({ where: { email } });
          if (existing) {
            return existing;
          }
          const newUser = await tx.usuario.create({
            data: {
              nombre: googleData.name || email.split("@")[0],
              email,
              // Los usuarios de Google no tienen passwordHash — solo pueden entrar por Google.
              // Generamos un hash aleatorio para que no se pueda usar con login normal.
              passwordHash: `google-only:${googleData.sub}`,
              telefono: null,
              role: "dueno",
              duenoId: null,
            },
          });

          // Crear configuración por defecto para este dueño
          await tx.configuracion.create({
            data: {
              duenoId: newUser.id,
              nombreDueno: newUser.nombre,
              nombreChofer: newUser.nombre,
            },
          });

          return newUser;
        });
      } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_HAS_USERS") {
          return NextResponse.json(
            { error: "Ya existe una cuenta registrada. Pídele al dueño que te agregue como chofer." },
            { status: 403 }
          );
        }
        throw err;
      }

      if (!user) {
        return NextResponse.json(
          { error: "No se pudo crear la cuenta" },
          { status: 500 }
        );
      }
    }

    // En este punto user siempre existe. Verificar si está activo.
    if (!user.activo) {
      return NextResponse.json(
        { error: "Tu cuenta está inactiva. Contacta al dueño." },
        { status: 403 }
      );
    }

    // Crear sesión
    const sessionUser = {
      userId: user!.id,
      email: user!.email,
      nombre: user!.nombre,
      role: user!.role as "dueno" | "chofer",
      duenoId: user!.duenoId,
    };
    const token = await signToken(sessionUser);
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    await setSessionCookie(token, isHttps);

    return NextResponse.json({ user: sessionUser, token });
  } catch (err) {
    console.error("Google auth error:", err);
    return NextResponse.json(
      { error: "No se pudo verificar el token de Google. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
