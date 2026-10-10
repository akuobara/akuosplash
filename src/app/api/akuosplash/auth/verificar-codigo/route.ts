// POST /api/akuosplash/auth/verificar-codigo
// Body: { email, codigo, nombre?, rol? }
// Si el usuario ya existe → inicia sesión. Si no existe y se envía `nombre` → lo crea.
import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie } from "@/lib/akuosplash-auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const codigo = String(body.codigo || "").trim();
    const nombre = body.nombre?.trim() || null;
    const rol = body.rol || "cliente";

    if (!email) {
      return NextResponse.json({ error: "Debes indicar email" }, { status: 400 });
    }
    if (!codigo || codigo.length !== 6) {
      return NextResponse.json({ error: "El código debe tener 6 dígitos" }, { status: 400 });
    }
    if (!["cliente", "transportista", "superadmin"].includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // Buscar código válido
    const hace10min = new Date(Date.now() - 10 * 60 * 1000);
    const codigos = await akuosplashDb.akuoCodigoLogin.findMany({
      where: {
        email,
        codigo,
        expiraEn: { gte: hace10min },
        usado: false,
      },
      orderBy: { creadoEn: "desc" },
      take: 5,
    });

    if (codigos.length === 0) {
      return NextResponse.json(
        { error: "Código inválido o expirado. Solicitá uno nuevo." },
        { status: 400 }
      );
    }

    // Marcar el código como usado
    await akuosplashDb.akuoCodigoLogin.update({
      where: { id: codigos[0].id },
      data: { usado: true },
    });

    // Buscar o crear usuario
    let usuario = await akuosplashDb.akuoUsuario.findUnique({ where: { email } });

    if (!usuario && nombre) {
      // Bootstrap: si no existe ningún superadmin, el primer usuario que se registra
      // se convierte automáticamente en superadmin (sin requerir aprobación).
      const superadminExistente = await akuosplashDb.akuoUsuario.findFirst({
        where: { rol: "superadmin" },
      });
      const rolFinal = superadminExistente ? rol : "superadmin";

      const vehiculosPermitidos = rolFinal === "superadmin" ? 999 : 1;
      usuario = await akuosplashDb.akuoUsuario.create({
        data: {
          email,
          nombre,
          rol: rolFinal,
          aprobado: rolFinal !== "transportista",
          plan: "free",
          vehiculosPermitidos,
        },
      });
      // Notificación de bienvenida
      await akuosplashDb.akuoNotificacion.create({
        data: {
          usuarioId: usuario.id,
          tipo: "bienvenida",
          titulo: "¡Bienvenido a AkuoSplash!",
          mensaje: `Hola ${nombre}, tu cuenta fue creada como ${rolFinal}.`,
          link: "/akuosplash",
        },
      });
    } else if (!usuario && !nombre) {
      return NextResponse.json(
        {
          error: "No existe una cuenta con ese email. Indicá tu nombre para registrarte.",
          requiereRegistro: true,
        },
        { status: 404 }
      );
    }

    if (!usuario) {
      return NextResponse.json({ error: "No se pudo autenticar" }, { status: 500 });
    }

    if (!usuario.activo) {
      return NextResponse.json({ error: "Tu cuenta está desactivada" }, { status: 403 });
    }
    if (usuario.banned) {
      return NextResponse.json(
        { error: `Tu cuenta está bloqueada. Motivo: ${usuario.banRazon || "no especificado"}` },
        { status: 403 }
      );
    }

    // Actualizar último login
    await akuosplashDb.akuoUsuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEn: new Date() },
    });

    // Crear token y cookie de sesión
    const token = await akuoSignToken({
      userId: usuario.id,
      rol: usuario.rol,
      nombre: usuario.nombre,
    });
    await akuoSetSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        id: usuario.id,
        email: usuario.email,
        telefono: usuario.telefono,
        nombre: usuario.nombre,
        rol: usuario.rol,
        aprobado: usuario.aprobado,
      },
    });
  } catch (e) {
    console.error("AkuoSplash verificar-codigo error:", e);
    return NextResponse.json({ error: "No se pudo verificar el código" }, { status: 500 });
  }
}
