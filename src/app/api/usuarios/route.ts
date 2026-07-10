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
    return NextResponse.json({ error: "Solo dueños" }, { status: 403 });
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
    return NextResponse.json({ error: "Solo dueños pueden crear choferes" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { nombre, email, password, telefono, esDuenoAsignadoComoChofer } = body;

    if (!nombre?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Nombre y email son obligatorios" }, { status: 400 });
    }

    // Si es dueño asignándose a sí mismo como chofer de un camión, no necesita crear usuario
    if (esDuenoAsignadoComoChofer) {
      return NextResponse.json({ usuario: { id: session.userId, nombre: session.nombre, email: session.email, role: "dueno" } });
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: "Contraseña mínima de 4 caracteres" }, { status: 400 });
    }

    const existing = await db.usuario.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const nuevo = await db.usuario.create({
      data: {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hashPassword(password),
        telefono: telefono?.trim() || null,
        role: "chofer",
        duenoId: session.userId,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        telefono: true,
        role: true,
        activo: true,
        duenoId: true,
        creadoEn: true,
      },
    });

    return NextResponse.json({ usuario: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el chofer" }, { status: 500 });
  }
}
