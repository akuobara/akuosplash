import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/vueltas/[id]/cerrar
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
  // Solo el chofer que inició la vuelta puede cerrarla
  // (el admin no debería cerrar vueltas que no inició él)
  if (vuelta.choferId !== session.userId) {
    return NextResponse.json(
      { error: "Solo el chofer que inició esta vuelta puede cerrarla" },
      { status: 403 }
    );
  }

  const actualizada = await db.vuelta.update({
    where: { id },
    data: { activa: false, cerradaEn: new Date() },
  });

  return NextResponse.json({ vuelta: actualizada });
}
