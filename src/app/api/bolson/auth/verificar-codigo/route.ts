// POST /api/bolson/auth/verificar-codigo
// Body: { telefono?, email?, codigo, nombre?, rol?, rutEmpresa?, razonSocial?, ... }
// Si el usuario ya existe → inicia sesión. Si no existe y se envía `nombre` → lo crea.
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonSignToken, bolsonSetSessionCookie } from "@/lib/bolson-auth";

// Seeder de categorías: flete, mudanza, escombros
async function seedCategoriasSiVacio() {
  const count = await bolsonDb.bolsonCategoria.count();
  if (count > 0) return;
  await bolsonDb.bolsonCategoria.createMany({
    data: [
      { slug: "flete", nombre: "Flete", descripcion: "Traslado de mercadería en general — encomiendas grandes, palets, muebles, etc.", icono: "📦", orden: 1 },
      { slug: "mudanza", nombre: "Mudanza", descripcion: "Casa o departamento completo — incluye personal extra, embalaje opcional, camión con caja cerrada.", icono: "🏠", orden: 2 },
      { slug: "escombros", nombre: "Escombros", descripcion: "Retiro de escombros, tierra, material de demolición — camión con caja abierta o tolva.", icono: "🚚", orden: 3 },
    ],
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const telefono = body.telefono?.trim() || null;
    const email = body.email?.trim().toLowerCase() || null;
    const codigo = String(body.codigo || "").trim();
    const nombre = body.nombre?.trim() || null;
    const rol = body.rol || "cliente"; // cliente | transportista | superadmin

    if (!telefono && !email) {
      return NextResponse.json({ error: "Debes indicar teléfono o email" }, { status: 400 });
    }
    if (!codigo || codigo.length !== 6) {
      return NextResponse.json({ error: "El código debe tener 6 dígitos" }, { status: 400 });
    }
    if (!["cliente", "transportista", "superadmin"].includes(rol)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // Buscar código válido
    const hace10min = new Date(Date.now() - 10 * 60 * 1000);
    const codigos = await bolsonDb.bolsonCodigoLogin.findMany({
      where: {
        OR: [
          ...(telefono ? [{ telefono }] : []),
          ...(email ? [{ email }] : []),
        ],
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
    await bolsonDb.bolsonCodigoLogin.update({
      where: { id: codigos[0].id },
      data: { usado: true },
    });

    // Buscar o crear usuario
    let usuario = await bolsonDb.bolsonUsuario.findFirst({
      where: {
        OR: [
          ...(telefono ? [{ telefono }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
    });

    if (!usuario && nombre) {
      // Bootstrap: si no existe ningún superadmin, el primer usuario que se registra
      // se convierte automáticamente en superadmin (sin requerir aprobación).
      const superadminExistente = await bolsonDb.bolsonUsuario.findFirst({
        where: { rol: "superadmin" },
      });
      const rolFinal = superadminExistente ? rol : "superadmin";

      // Crear nuevo usuario
      usuario = await bolsonDb.bolsonUsuario.create({
        data: {
          email,
          telefono,
          nombre,
          rol: rolFinal,
          aprobado: rolFinal !== "transportista",
        },
      });
      // Notificación de bienvenida
      await bolsonDb.bolsonNotificacion.create({
        data: {
          usuarioId: usuario.id,
          tipo: "bienvenida",
          titulo: "¡Bienvenido a Bolsón!",
          mensaje: `Hola ${nombre}, tu cuenta fue creada como ${rolFinal}.`,
          link: "/bolson",
        },
      });
      // Si era el primer superadmin, asegurar categorías sembradas
      if (!superadminExistente) {
        await seedCategoriasSiVacio();
      }
    } else if (!usuario && !nombre) {
      return NextResponse.json(
        { error: "No existe una cuenta con ese dato. Indicá tu nombre para registrarte.",
          requiereRegistro: true },
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
    await bolsonDb.bolsonUsuario.update({
      where: { id: usuario.id },
      data: { ultimoLoginEn: new Date() },
    });

    // Crear token y cookie de sesión
    const token = await bolsonSignToken({
      userId: usuario.id,
      rol: usuario.rol,
      nombre: usuario.nombre,
    });
    await bolsonSetSessionCookie(token);

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
    console.error("Bolson verificar-codigo error:", e);
    return NextResponse.json({ error: "No se pudo verificar el código" }, { status: 500 });
  }
}
