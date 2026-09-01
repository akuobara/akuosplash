import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPasswordCliente, signTokenCliente, setSessionCookieCliente } from "@/lib/auth-cliente";

// POST /api/cliente/auth/registro
// Registro de un nuevo cliente de la app (sin vincular a ningún admin)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Campos obligatorios
    if (!body.email?.trim() || !body.password || !body.nombre?.trim() || !body.zonaId) {
      return NextResponse.json(
        { error: "Nombre, email, contraseña y zona son obligatorios" },
        { status: 400 }
      );
    }

    if (String(body.password).length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Verificar que la zona exista y esté activa
    const zona = await db.zona.findFirst({
      where: { id: body.zonaId, activa: true },
    });
    if (!zona) {
      return NextResponse.json({ error: "Zona inválida" }, { status: 400 });
    }

    const emailNorm = body.email.trim().toLowerCase();

    // Verificar email duplicado
    const existente = await db.clienteApp.findUnique({ where: { email: emailNorm } });
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese email. Iniciá sesión." },
        { status: 409 }
      );
    }

    // Normalizar teléfono
    let telefonoNormalizado: string | null = null;
    if (body.telefono?.trim()) {
      const digits = body.telefono.replace(/\D/g, "");
      if (digits.length >= 8) telefonoNormalizado = "+" + digits;
    }

    // Crear cliente-app
    const nuevo = await db.clienteApp.create({
      data: {
        email: emailNorm,
        passwordHash: hashPasswordCliente(String(body.password)),
        nombre: body.nombre.trim(),
        rut: body.rut?.trim() || null,
        telefono: telefonoNormalizado,
        direccion: body.direccion?.trim() || null,
        zonaId: zona.id,
        lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
        lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
        // Acceso
        requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
        entregaDesdeAfuera: !!body.entregaDesdeAfuera,
        conexionExterna: !!body.conexionExterna,
        requiereClientePresente: body.requiereClientePresente !== false,
        indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
        // Uso del agua
        usoAgua: body.usoAgua || "consumo",
        usoAguaNota: body.usoAguaNota?.trim() || null,
        estanquesJson: body.estanquesJson || null,
        // Preferencias
        tiempoAceptacionPreferidoMin: Number(body.tiempoAceptacionPreferidoMin) || 15,
        saldo: 0,
        entregasExitosas: 0,
        activo: true,
      },
    });

    // Generar JWT (sin duenoId porque no pertenece a ningún admin)
    const isHttps = req.headers.get("x-forwarded-proto") === "https";
    const token = await signTokenCliente({
      clienteId: nuevo.id,
      email: emailNorm,
      nombre: nuevo.nombre,
      duenoId: "", // vacío: el cliente no tiene admin
    });
    await setSessionCookieCliente(token, isHttps);

    return NextResponse.json({
      cliente: {
        id: nuevo.id,
        nombre: nuevo.nombre,
        email: nuevo.email,
      },
      token,
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo registrar" }, { status: 500 });
  }
}
