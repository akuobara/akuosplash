import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/vueltas/[id]/reabrir
// Reabre una vuelta cerrada para seguir registrando entregas.
// Si hay otra vuelta activa, se cierra primero (solo puede haber una activa a la vez).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const vuelta = await db.vuelta.findUnique({ where: { id } });
  if (!vuelta || vuelta.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (session.role === "chofer" && vuelta.choferId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (vuelta.activa) {
    return NextResponse.json({ error: "La vuelta ya está activa" }, { status: 400 });
  }

  // Cerrar cualquier vuelta activa actualmente (solo puede haber una)
  const activaActual = await db.vuelta.findFirst({
    where: { activa: true, duenoId },
  });
  if (activaActual && activaActual.id !== id) {
    await db.vuelta.update({
      where: { id: activaActual.id },
      data: { activa: false, cerradaEn: new Date() },
    });
  }

  const actualizada = await db.vuelta.update({
    where: { id },
    data: { activa: true, cerradaEn: null },
    include: {
      camion: { select: { id: true, nombre: true, patente: true, capacidad: true } },
      chofer: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ vuelta: actualizada });
}
