import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// GET /api/camiones/[id] — detalle de un camión (dueño o chofer asignado)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const camion = await db.camion.findUnique({
    where: { id },
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

  if (!camion) {
    return NextResponse.json({ error: "Camión no encontrado" }, { status: 404 });
  }

  // Verificar acceso
  if (session.role === "dueno") {
    if (camion.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (session.role === "chofer") {
    // Chofer: debe estar asignado al camión (o ser parte del equipo del dueño)
    const asignacion = await db.camionChofer.findUnique({
      where: { camionId_choferId: { camionId: id, choferId: session.userId } },
    });
    if (!asignacion && camion.duenoId !== session.duenoId) {
      return NextResponse.json({ error: "No tienes acceso a este camión" }, { status: 403 });
    }
  }

  return NextResponse.json({ camion });
}

// PATCH /api/camiones/[id] — solo dueño
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;

  // Verificar propiedad
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion || camion.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();

  const actualizado = await db.camion.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.patente !== undefined && { patente: body.patente?.trim() || null }),
      ...(body.capacidad !== undefined && { capacidad: Number(body.capacidad) || 0 }),
      ...(body.activo !== undefined && { activo: !!body.activo }),
      // Datos del vehículo
      ...(body.marca !== undefined && { marca: body.marca?.trim() || null }),
      ...(body.modelo !== undefined && { modelo: body.modelo?.trim() || null }),
      ...(body.anio !== undefined && { anio: body.anio ? Number(body.anio) : null }),
      ...(body.color !== undefined && { color: body.color?.trim() || null }),
      ...(body.numeroMotor !== undefined && { numeroMotor: body.numeroMotor?.trim() || null }),
      ...(body.numeroChasis !== undefined && { numeroChasis: body.numeroChasis?.trim() || null }),
      // Documentos
      ...(body.permisoCirculacionVencimiento !== undefined && { permisoCirculacionVencimiento: body.permisoCirculacionVencimiento ? new Date(body.permisoCirculacionVencimiento) : null }),
      ...(body.permisoCirculacionFotoUrl !== undefined && { permisoCirculacionFotoUrl: body.permisoCirculacionFotoUrl || null }),
      ...(body.revisionTecnicaVencimiento !== undefined && { revisionTecnicaVencimiento: body.revisionTecnicaVencimiento ? new Date(body.revisionTecnicaVencimiento) : null }),
      ...(body.revisionTecnicaFotoUrl !== undefined && { revisionTecnicaFotoUrl: body.revisionTecnicaFotoUrl || null }),
      ...(body.seguroVencimiento !== undefined && { seguroVencimiento: body.seguroVencimiento ? new Date(body.seguroVencimiento) : null }),
      ...(body.seguroFotoUrl !== undefined && { seguroFotoUrl: body.seguroFotoUrl || null }),
      ...(body.seguroCompania !== undefined && { seguroCompania: body.seguroCompania?.trim() || null }),
      ...(body.seguroNumero !== undefined && { seguroNumero: body.seguroNumero?.trim() || null }),
      // Configuración del camión (carrocería y estanque)
      ...(body.carroceria !== undefined && { carroceria: body.carroceria?.trim() || null }),
      ...(body.tipoCisterna !== undefined && { tipoCisterna: body.tipoCisterna?.trim() || null }),
      ...(body.materialEstanque !== undefined && { materialEstanque: body.materialEstanque?.trim() || null }),
      ...(body.tipoAgua !== undefined && { tipoAgua: body.tipoAgua?.trim() || null }),
      // Resolución sanitaria (solo aplica si tipoAgua = consumo_humano)
      ...(body.resolucionSanitaria !== undefined && { resolucionSanitaria: body.resolucionSanitaria?.trim() || null }),
      ...(body.resolucionSanitariaVencimiento !== undefined && { resolucionSanitariaVencimiento: body.resolucionSanitariaVencimiento ? new Date(body.resolucionSanitariaVencimiento) : null }),
      ...(body.resolucionSanitariaFotoUrl !== undefined && { resolucionSanitariaFotoUrl: body.resolucionSanitariaFotoUrl || null }),
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

  return NextResponse.json({ camion: actualizado });
}

// DELETE /api/camiones/[id] — solo dueño
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;

  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion || camion.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await db.vuelta.updateMany({
    where: { camionId: id },
    data: { camionId: null },
  });

  await db.camion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
