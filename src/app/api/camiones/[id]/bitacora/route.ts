import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/camiones/[id]/bitacora — lista las entradas de bitácora de un camión.
// Accessible por el dueño (propietario) y por choferes asignados al camión.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Verificar acceso al camión
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion) {
    return NextResponse.json({ error: "Camión no encontrado" }, { status: 404 });
  }

  if (session.role === "dueno") {
    if (camion.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else {
    // Chofer: debe estar asignado al camión
    const asignacion = await db.camionChofer.findUnique({
      where: { camionId_choferId: { camionId: id, choferId: session.userId } },
    });
    if (!asignacion) {
      return NextResponse.json({ error: "No tienes acceso a este camión" }, { status: 403 });
    }
  }

  const entradas = await db.bitacoraCamion.findMany({
    where: { camionId: id },
    orderBy: { creadoEn: "desc" },
    include: {
      autor: { select: { id: true, nombre: true, role: true } },
      resueltaPor: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ entradas });
}

// POST /api/camiones/[id]/bitacora — registra una nueva entrada en la bitácora.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Verificar acceso al camión
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion) {
    return NextResponse.json({ error: "Camión no encontrado" }, { status: 404 });
  }

  if (session.role === "dueno") {
    if (camion.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else {
    const asignacion = await db.camionChofer.findUnique({
      where: { camionId_choferId: { camionId: id, choferId: session.userId } },
    });
    if (!asignacion) {
      return NextResponse.json({ error: "No tienes acceso a este camión" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();

    if (!body.descripcion?.trim()) {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }

    const tipo = body.tipo?.trim() || "observacion";
    const tiposValidos = ["falla_mecanica", "mantenimiento", "observacion", "otro"];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
    }

    const severidad = body.severidad?.trim() || null;
    const severidadesValidas = ["baja", "media", "alta", "critica"];
    if (severidad && !severidadesValidas.includes(severidad)) {
      return NextResponse.json({ error: "Severidad no válida" }, { status: 400 });
    }

    const entrada = await db.bitacoraCamion.create({
      data: {
        camionId: id,
        autorId: session.userId,
        tipo,
        descripcion: body.descripcion.trim(),
        severidad,
      },
      include: {
        autor: { select: { id: true, nombre: true, role: true } },
      },
    });

    return NextResponse.json({ entrada }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo registrar la entrada" }, { status: 500 });
  }
}

// PATCH /api/camiones/[id]/bitacora?entradaId=X — marcar como resuelta/no resuelta.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const entradaId = searchParams.get("entradaId");
  if (!entradaId) {
    return NextResponse.json({ error: "Falta entradaId" }, { status: 400 });
  }

  // Solo el dueño puede marcar como resuelta
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo el dueño puede marcar entradas como resueltas" }, { status: 403 });
  }

  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion || camion.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const resuelta = !!body.resuelta;

  const entrada = await db.bitacoraCamion.update({
    where: { id: entradaId, camionId: id },
    data: resuelta
      ? { resuelta: true, resueltaEn: new Date(), resueltaPorId: session.userId }
      : { resuelta: false, resueltaEn: null, resueltaPorId: null },
    include: {
      autor: { select: { id: true, nombre: true, role: true } },
      resueltaPor: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ entrada });
}
