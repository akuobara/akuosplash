import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getSession } from "@/lib/auth";

// GET /api/usuarios — lista los choferes del dueño actual
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const usuarios = await db.usuario.findMany({
    where: {
      OR: [
        { duenoId: session.userId },
        { id: session.userId }, // incluirse a sí mismo
      ],
    },
    orderBy: [{ role: "asc" }, { nombre: "asc" }],
    select: {
      id: true,
      email: true,
      nombre: true,
      telefono: true,
      role: true,
      activo: true,
      duenoId: true,
      creadoEn: true,
      licenciaClase: true,
      licenciaNumero: true,
      licenciaVencimiento: true,
      licenciaFotoUrl: true,
      _count: {
        select: {
          vueltasComoChofer: true,
          entregasComoChofer: true,
          asignaciones: true,
        },
      },
    },
  });

  return NextResponse.json({ usuarios });
}

// POST /api/usuarios — el dueño crea un chofer
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores pueden crear choferes" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, email, password, telefono, esDuenoAsignadoComoChofer } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: "Nombre es obligatorio" }, { status: 400 });
    }

    if (!email?.trim() && !telefono?.trim()) {
      return NextResponse.json({ error: "Email o teléfono es obligatorio" }, { status: 400 });
    }

    // Si es dueño asignándose a sí mismo como chofer de un camión, no necesita crear usuario
    if (esDuenoAsignadoComoChofer) {
      return NextResponse.json({ usuario: { id: session.userId, nombre: session.nombre, email: session.email, role: "dueno" } });
    }

    // === Validar límite del plan ===
    const config = await db.configuracion.findUnique({
      where: { duenoId: session.userId },
      select: { planId: true },
    });
    const planId = config?.planId || "free";
    const plan = await db.plan.findUnique({
      where: { id: planId },
      select: { maxChoferes: true },
    });
    if (plan && plan.maxChoferes >= 0) {
      const choferesActuales = await db.usuario.count({
        where: { duenoId: session.userId, role: "chofer" },
      });
      if (choferesActuales >= plan.maxChoferes) {
        return NextResponse.json({
          error: `Tu plan ${planId} permite máximo ${plan.maxChoferes} chofer(es). Actualizá tu plan para agregar más.`,
        }, { status: 403 });
      }
    }

    // Normalizar teléfono
    let telefonoNormalizado: string | null = null;
    if (telefono?.trim()) {
      const digits = telefono.trim().replace(/\D/g, "");
      if (digits.length >= 8) telefonoNormalizado = "+" + digits;
    }

    // Normalizar email (puede no venir)
    let emailFinal: string | null = null;
    if (email?.trim()) {
      emailFinal = email.trim().toLowerCase();
    }

    // Buscar usuario existente por email o teléfono
    let existingUser: Awaited<ReturnType<typeof db.usuario.findUnique>> = null;
    if (emailFinal) {
      existingUser = await db.usuario.findUnique({ where: { email: emailFinal as string } });
    }
    if (!existingUser && telefonoNormalizado) {
      existingUser = await db.usuario.findFirst({ where: { telefono: telefonoNormalizado } });
    }

    if (existingUser) {
      // El usuario ya existe — vincularlo como chofer de este administrador
      if (existingUser.role === "dueno" && existingUser.id !== session.userId) {
        return NextResponse.json({ error: "Este usuario ya es administrador de otra cuenta" }, { status: 409 });
      }
      if (existingUser.role === "super_admin") {
        return NextResponse.json({ error: "No puedes agregar a un súper administrador como chofer" }, { status: 409 });
      }

      // Si ya es chofer de este dueño, no hacer nada
      if (existingUser.role === "chofer" && existingUser.duenoId === session.userId) {
        return NextResponse.json({ 
          usuario: { 
            id: existingUser.id, 
            nombre: existingUser.nombre, 
            email: existingUser.email, 
            telefono: existingUser.telefono,
            role: existingUser.role,
            activo: existingUser.activo,
            duenoId: existingUser.duenoId,
          },
          mensaje: "Este chofer ya está agregado a tu cuenta",
        });
      }

      // Si es chofer de otro dueño o no tiene dueño, reasignarlo
      const actualizado = await db.usuario.update({
        where: { id: existingUser.id },
        data: {
          duenoId: session.userId,
          role: "chofer",
          activo: true,
          // Actualizar nombre y licencia si vienen
          ...(nombre.trim() && { nombre: nombre.trim() }),
          ...(telefonoNormalizado && { telefono: telefonoNormalizado }),
          ...(body.licenciaClase && { licenciaClase: body.licenciaClase }),
          ...(body.licenciaNumero?.trim() && { licenciaNumero: body.licenciaNumero.trim() }),
          ...(body.licenciaVencimiento && { licenciaVencimiento: new Date(body.licenciaVencimiento) }),
          ...(body.licenciaFotoUrl && { licenciaFotoUrl: body.licenciaFotoUrl }),
        },
        select: {
          id: true, email: true, nombre: true, telefono: true, role: true, activo: true, duenoId: true, creadoEn: true,
          licenciaClase: true, licenciaNumero: true, licenciaVencimiento: true, licenciaFotoUrl: true,
          _count: { select: { vueltasComoChofer: true, entregasComoChofer: true, asignaciones: true } },
        },
      });

      return NextResponse.json({ usuario: actualizado, mensaje: "Chofer existente vinculado a tu cuenta" });
    }

    // No existe — crear nuevo usuario
    // Generar email ficticio si no viene
    if (!emailFinal && telefonoNormalizado) {
      emailFinal = `phone_${telefonoNormalizado.replace(/\D/g, "")}@aljibeapp.local`;
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: "Contraseña mínima de 4 caracteres (requerida para usuarios nuevos)" }, { status: 400 });
    }

    const nuevo = await db.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: emailFinal!,
        passwordHash: hashPassword(password),
        telefono: telefonoNormalizado,
        role: "chofer",
        duenoId: session.userId,
        licenciaClase: body.licenciaClase || null,
        licenciaNumero: body.licenciaNumero?.trim() || null,
        licenciaVencimiento: body.licenciaVencimiento ? new Date(body.licenciaVencimiento) : null,
        licenciaFotoUrl: body.licenciaFotoUrl || null,
      },
      select: {
        id: true, email: true, nombre: true, telefono: true, role: true, activo: true, duenoId: true, creadoEn: true,
        licenciaClase: true, licenciaNumero: true, licenciaVencimiento: true, licenciaFotoUrl: true,
        _count: { select: { vueltasComoChofer: true, entregasComoChofer: true, asignaciones: true } },
      },
    });

    return NextResponse.json({ usuario: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el chofer" }, { status: 500 });
  }
}
