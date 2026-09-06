import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// GET /api/camiones/[id]/choferes — lista choferes asignados a este camión
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion) {
    return NextResponse.json({ error: "Camión no encontrado" }, { status: 404 });
  }

  // Chofer: solo si está asignado a este camión
  if (session.role === "chofer") {
    const asignado = await db.camionChofer.findUnique({
      where: { camionId_choferId: { camionId: id, choferId: session.userId } },
    });
    if (!asignado && camion.duenoId !== session.duenoId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else {
    // Dueño: debe ser el dueño del camión
    if (camion.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  const asignaciones = await db.camionChofer.findMany({
    where: { camionId: id },
    include: {
      chofer: {
        select: {
          id: true,
          nombre: true,
          email: true,
          telefono: true,
          role: true,
          activo: true,
        },
      },
    },
    orderBy: { asignadoEn: "asc" },
  });

  return NextResponse.json({
    choferes: asignaciones.map((a) => ({ ...a.chofer, asignadoEn: a.asignadoEn })),
  });
}

// POST /api/camiones/[id]/choferes — asignar chofer al camión
// body: { choferId }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const body = await req.json();
  const { choferId } = body;

  if (!choferId) {
    return NextResponse.json({ error: "choferId es obligatorio" }, { status: 400 });
  }

  // Verificar que el camión pertenece al dueño
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion || camion.duenoId !== session.userId) {
    return NextResponse.json({ error: "Camión no autorizado" }, { status: 403 });
  }

  // Verificar que el chofer pertenece al dueño (o es el dueño mismo)
  const chofer = await db.usuario.findUnique({ where: { id: choferId }, select: { id: true, role: true, duenoId: true, activo: true } });
  if (!chofer) {
    return NextResponse.json({ error: "Chofer no encontrado" }, { status: 404 });
  }
  // Rechazar cualquier usuario que no sea el dueño mismo o un chofer del dueño
  const esValido = chofer.id === session.userId || (chofer.role === "chofer" && chofer.duenoId === session.userId);
  if (!esValido) {
    return NextResponse.json({ error: "Chofer no autorizado" }, { status: 403 });
  }

  // No permitir asignar choferes inactivos (soft-deleted)
  if (chofer.role === "chofer" && !chofer.activo) {
    return NextResponse.json({ error: "Este chofer está inactivo. Actívalo en la pestaña Equipo antes de asignarlo." }, { status: 400 });
  }

  // Crear asignación (si ya existe, no falla)
  const existente = await db.camionChofer.findUnique({
    where: { camionId_choferId: { camionId: id, choferId } },
  });
  if (existente) {
    return NextResponse.json({ ok: true, ya_asignado: true });
  }

  await db.camionChofer.create({
    data: { camionId: id, choferId },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/camiones/[id]/choferes?choferId=... — desasignar chofer
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { searchParams } = new URL(req.url);
  const choferId = searchParams.get("choferId");

  if (!choferId) {
    return NextResponse.json({ error: "choferId query param obligatorio" }, { status: 400 });
  }

  // Verificar que el camión pertenece al dueño
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion || camion.duenoId !== session.userId) {
    return NextResponse.json({ error: "Camión no autorizado" }, { status: 403 });
  }

  await db.camionChofer.deleteMany({
    where: { camionId: id, choferId },
  });

  return NextResponse.json({ ok: true });
}
