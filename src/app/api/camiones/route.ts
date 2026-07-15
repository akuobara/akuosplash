import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/camiones
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Dueño: ve todos sus camiones
  // Chofer: ve solo los camiones asignados a él
  if (session.role === "dueno") {
    const camiones = await db.camion.findMany({
      where: { duenoId: session.userId },
      orderBy: { creadoEn: "asc" },
      include: {
        _count: { select: { vueltas: true } },
        choferes: {
          include: {
            chofer: {
              select: { id: true, nombre: true, email: true, telefono: true, role: true, activo: true },
            },
          },
        },
      },
    });
    return NextResponse.json({ camiones });
  } else {
    // Chofer
    const asignaciones = await db.camionChofer.findMany({
      where: { choferId: session.userId },
      include: {
        camion: {
          include: {
            _count: { select: { vueltas: true } },
            choferes: {
              include: {
                chofer: {
                  select: { id: true, nombre: true, email: true, telefono: true, role: true, activo: true },
                },
              },
            },
          },
        },
      },
    });
    const camiones = asignaciones
      .map((a) => a.camion)
      .filter((c) => c.activo);
    return NextResponse.json({ camiones });
  }
}

// POST /api/camiones — solo dueño
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores pueden agregar camiones" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    const capacidad = Number(body.capacidad) || 0;
    if (capacidad <= 0) {
      return NextResponse.json({ error: "La capacidad debe ser mayor a 0" }, { status: 400 });
    }

    const nuevo = await db.camion.create({
      data: {
        nombre: body.nombre.trim(),
        patente: body.patente?.trim() || null,
        capacidad,
        activo: body.activo !== false,
        duenoId: session.userId,
        // Datos del vehículo
        marca: body.marca?.trim() || null,
        modelo: body.modelo?.trim() || null,
        anio: body.anio ? Number(body.anio) : null,
        color: body.color?.trim() || null,
        numeroMotor: body.numeroMotor?.trim() || null,
        numeroChasis: body.numeroChasis?.trim() || null,
        // Documentos
        permisoCirculacionVencimiento: body.permisoCirculacionVencimiento ? new Date(body.permisoCirculacionVencimiento) : null,
        permisoCirculacionFotoUrl: body.permisoCirculacionFotoUrl || null,
        revisionTecnicaVencimiento: body.revisionTecnicaVencimiento ? new Date(body.revisionTecnicaVencimiento) : null,
        revisionTecnicaFotoUrl: body.revisionTecnicaFotoUrl || null,
        seguroVencimiento: body.seguroVencimiento ? new Date(body.seguroVencimiento) : null,
        seguroFotoUrl: body.seguroFotoUrl || null,
        seguroCompania: body.seguroCompania?.trim() || null,
        seguroNumero: body.seguroNumero?.trim() || null,
      },
      include: {
        _count: { select: { vueltas: true } },
        choferes: {
          include: {
            chofer: {
              select: { id: true, nombre: true, email: true, telefono: true, role: true, activo: true },
            },
          },
        },
      },
    });

    // Si el dueño pidió auto-asignarse, hacerlo
    if (body.autoAsignarDueno) {
      await db.camionChofer.create({
        data: { camionId: nuevo.id, choferId: session.userId },
      }).catch(() => {}); // ignorar si ya existe
    }

    // Recargar con choferes
    const recargado = await db.camion.findUnique({
      where: { id: nuevo.id },
      include: {
        _count: { select: { vueltas: true } },
        choferes: {
          include: {
            chofer: {
              select: { id: true, nombre: true, email: true, telefono: true, role: true, activo: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ camion: recargado }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el camión" }, { status: 500 });
  }
}
