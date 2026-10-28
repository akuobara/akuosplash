import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoSignToken, akuoSetSessionCookie, akuoNotificar } from "@/lib/akuosplash-auth";
import { detectarZona } from "@/lib/akuosplash-mercadopago";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    // Asegurar que las columnas nuevas existan antes de cualquier query
    await ensureAkuoConfigColumns();
    const body = await req.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const nombre = body.nombre?.trim();
    const telefono = body.telefono?.trim() || null;
    const rol = body.rol || "cliente";
    const rut = body.rut?.trim() || null;
    const direccion = body.direccion?.trim() || null;
    const comuna = body.comuna?.trim() || null;
    const lat = body.lat != null && body.lat !== "" ? Number(body.lat) : null;
    const lng = body.lng != null && body.lng !== "" ? Number(body.lng) : null;
    const indicacionesAcceso = body.indicacionesAcceso?.trim() || null;

    if (!email || !password || !nombre) return NextResponse.json({ error: "Email, contraseña y nombre son obligatorios" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    if (!["cliente", "transportista"].includes(rol)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    // Para clientes, RUT y lat/lng son obligatorios (la zona se asigna por ubicación)
    if (rol === "cliente") {
      if (!rut) return NextResponse.json({ error: "El RUT es obligatorio" }, { status: 400 });
      if (lat == null || lng == null) return NextResponse.json({ error: "Tu ubicación (lat/lng) es obligatoria para asignarte una zona de servicio. Usá el botón 'Usar mi ubicación'." }, { status: 400 });
    }

    const existente = await akuosplashDb.akuoUsuario.findUnique({ where: { email } });
    if (existente) return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });

    // Detectar zona por lat/lng (igual que Aljibe)
    let zonaId: string | null = null;
    if (rol === "cliente" && lat != null && lng != null) {
      const zona = await detectarZona(lat, lng);
      if (!zona) {
        return NextResponse.json({
          error: "Lo sentimos, todavía no tenemos servicio en tu zona. Contactanos para verificar cobertura.",
        }, { status: 400 });
      }
      zonaId = zona.id;
    }

    const superadminExistente = await akuosplashDb.akuoUsuario.findFirst({ where: { rol: "superadmin" } });
    const rolFinal = superadminExistente ? rol : "superadmin";
    const passwordHash = await bcrypt.hash(password, 10);
    const vehiculosPermitidos = rolFinal === "superadmin" ? 999 : 1;

    // Tipo de persona + datos de empresa (solo para clientes)
    const tipoPersona = rol === "cliente" ? (body.tipoPersona === "empresa" ? "empresa" : "natural") : null;
    const rutEmpresa = body.rutEmpresa?.trim() || null;
    const razonSocial = body.razonSocial?.trim() || null;
    const direccionEmpresa = body.direccionEmpresa?.trim() || null;
    const giro = body.giro?.trim() || null;
    const comunaEmpresa = body.comunaEmpresa?.trim() || null;
    const ciudadEmpresa = body.ciudadEmpresa?.trim() || null;
    const telefonoEmpresa = body.telefonoEmpresa?.trim() || null;
    const emailEmpresa = body.emailEmpresa?.trim() || null;

    // Si es empresa, razonSocial y rutEmpresa son obligatorios
    if (tipoPersona === "empresa" && (!razonSocial || !rutEmpresa)) {
      return NextResponse.json({ error: "Para empresas, razón social y RUT de empresa son obligatorios" }, { status: 400 });
    }

    const usuario = await akuosplashDb.akuoUsuario.create({
      data: {
        email, nombre, telefono, passwordHash, rol: rolFinal,
        // Transportista puede usar la app inmediatamente (productividad)
        // La verificación del marketplace es separada (campo verificado)
        aprobado: true, plan: "free", vehiculosPermitidos,
        rut, direccion, comuna, lat, lng, indicacionesAcceso, zonaId,
        tipoPersona, rutEmpresa, razonSocial, direccionEmpresa, giro,
        comunaEmpresa, ciudadEmpresa, telefonoEmpresa, emailEmpresa,
      },
    });
    await akuoNotificar(usuario.id, "bienvenida", "¡Bienvenido a AkuoSplash!", `Hola ${nombre}, tu cuenta fue creada como ${rolFinal}. Ya podés usar la app.`, "/akuosplash");
    const token = await akuoSignToken({ userId: usuario.id, rol: usuario.rol, nombre: usuario.nombre });
    await akuoSetSessionCookie(token);
    return NextResponse.json({ ok: true, user: { id: usuario.id, email: usuario.email, telefono: usuario.telefono, nombre: usuario.nombre, rol: usuario.rol, aprobado: usuario.aprobado } });
  } catch (e) { console.error("Akuo register:", e); return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 }); }
}
