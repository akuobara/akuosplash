import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

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
  }

  // === CHOFER ===
  // 1. Buscar asignaciones explícitas en CamionChofer
  let asignaciones = await db.camionChofer.findMany({
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

  // === AUTO-RECUPERACIÓN ===
  // Si el chofer no tiene asignaciones explícitas PERO tiene una vuelta activa
  // con un camión, restaurar automáticamente la asignación CamionChofer.
  // Esto previene el bug donde se borraban las asignaciones al desactivar/reactivar
  // un chofer, dejándolo sin acceso a su camión.
  if (asignaciones.length === 0) {
    const vueltaActiva = await db.vuelta.findFirst({
      where: { activa: true, choferId: session.userId },
      include: { camion: true },
      orderBy: { iniciadaEn: "desc" },
    });

    if (vueltaActiva?.camionId && vueltaActiva.camion && vueltaActiva.camion.activo) {
      // Restaurar la asignación (upsert para evitar error si ya existe)
      try {
        await db.camionChofer.upsert({
          where: {
            camionId_choferId: {
              camionId: vueltaActiva.camionId,
              choferId: session.userId,
            },
          },
          update: {},
          create: {
            camionId: vueltaActiva.camionId,
            choferId: session.userId,
          },
        });
      } catch {
        // Si falla por cualquier razón (race condition, etc.), no bloquear al chofer
      }

      // Volver a cargar las asignaciones
      asignaciones = await db.camionChofer.findMany({
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
    }
  }

  const camiones = asignaciones
    .map((a) => a.camion)
    .filter((c) => c.activo);
  return NextResponse.json({ camiones });
}

// POST /api/camiones — solo dueño
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

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

    // === Validar límite del plan ===
    const config = await db.configuracion.findUnique({
      where: { duenoId: session.userId },
      select: { planId: true },
    });
    const planId = config?.planId || "free";
    const plan = await db.plan.findUnique({
      where: { id: planId },
      select: { maxCamiones: true },
    });
    if (plan && plan.maxCamiones >= 0) {
      const camionesActuales = await db.camion.count({
        where: { duenoId: session.userId },
      });
      if (camionesActuales >= plan.maxCamiones) {
        return NextResponse.json({
          error: `Tu plan ${planId} permite máximo ${plan.maxCamiones} camión(es). Actualizá tu plan para agregar más.`,
        }, { status: 403 });
      }
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
        // Configuración del camión (carrocería y estanque)
        carroceria: body.carroceria?.trim() || null,
        tipoCisterna: body.tipoCisterna?.trim() || null,
        materialEstanque: body.materialEstanque?.trim() || null,
        tipoAgua: body.tipoAgua?.trim() || null,
        // Resolución sanitaria (solo si tipoAgua = consumo_humano)
        resolucionSanitaria: body.resolucionSanitaria?.trim() || null,
        resolucionSanitariaVencimiento: body.resolucionSanitariaVencimiento ? new Date(body.resolucionSanitariaVencimiento) : null,
        resolucionSanitariaFotoUrl: body.resolucionSanitariaFotoUrl || null,
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
