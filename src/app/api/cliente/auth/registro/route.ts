import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPasswordCliente, signTokenCliente, setSessionCookieCliente } from "@/lib/auth-cliente";

// POST /api/cliente/auth/registro
// Registro de un nuevo cliente desde la app /cliente
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Campos obligatorios
    if (!body.email?.trim() || !body.password || !body.codigoAdmin?.trim() || !body.nombre?.trim()) {
      return NextResponse.json(
        { error: "Nombre, email, password y código de administrador son obligatorios" },
        { status: 400 }
      );
    }

    if (String(body.password).length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Buscar configuración por codigoAdmin
    const config = await db.configuracion.findFirst({
      where: { codigoVinculacion: body.codigoAdmin.trim().toUpperCase() },
    });
    if (!config || !config.duenoId) {
      return NextResponse.json(
        { error: "Código de administrador inválido. Pedile a tu proveedor el código correcto." },
        { status: 400 }
      );
    }

    const duenoId = config.duenoId;
    const emailNorm = body.email.trim().toLowerCase();

    // Verificar email duplicado (entre clientes con passwordHash, o sea, los que se registraron)
    const existente = await db.cliente.findFirst({
      where: { email: emailNorm, passwordHash: { not: null } },
    });
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email. Iniciá sesión." },
        { status: 409 }
      );
    }

    // Normalizar teléfono (formato +56XXXXXXXXX)
    let telefonoNormalizado: string | null = null;
    if (body.telefono?.trim()) {
      const digits = body.telefono.replace(/\D/g, "");
      if (digits.length >= 8) telefonoNormalizado = "+" + digits;
    }

    // Crear cliente
    const nuevo = await db.cliente.create({
      data: {
        duenoId,
        nombre: body.nombre.trim(),
        rut: body.rut?.trim() || null,
        direccion: body.direccion?.trim() || null,
        telefono: telefonoNormalizado,
        email: emailNorm,
        zona: body.zona?.trim() || null,
        // Precios heredados de la configuración del admin
        precioEfectivoPorLitro: config.precioEfectivoPorLitro || 0,
        precioTransferenciaPorLitro: config.precioTransferenciaPorLitro || 0,
        // GPS
        lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
        lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
        // Acceso
        requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
        entregaDesdeAfuera: !!body.entregaDesdeAfuera,
        conexionExterna: !!body.conexionExterna,
        requiereClientePresente: body.requiereClientePresente !== false, // default true
        indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
        // Uso del agua
        usoAgua: body.usoAgua || "consumo",
        usoAguaNota: body.usoAguaNota?.trim() || null,
        // Estanques
        estanquesJson: body.estanquesJson || null,
        // Auth
        passwordHash: hashPasswordCliente(String(body.password)),
        activo: true,
      },
    });

    // Generar JWT y setear cookie
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    const token = await signTokenCliente({
      clienteId: nuevo.id,
      email: emailNorm,
      nombre: nuevo.nombre,
      duenoId,
    });
    await setSessionCookieCliente(token, isHttps);

    return NextResponse.json({
      cliente: {
        id: nuevo.id,
        nombre: nuevo.nombre,
        email: nuevo.email,
      },
      token, // para que el cliente lo guarde en localStorage
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
