import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/camiones/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const actualizado = await db.camion.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.patente !== undefined && { patente: body.patente?.trim() || null }),
      ...(body.capacidad !== undefined && { capacidad: Number(body.capacidad) || 0 }),
      ...(body.activo !== undefined && { activo: !!body.activo }),
    },
    include: { _count: { select: { vueltas: true } } },
  });

  return NextResponse.json({ camion: actualizado });
}

// DELETE /api/camiones/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Desvincular vueltas (no borrarlas)
  await db.vuelta.updateMany({
    where: { camionId: id },
    data: { camionId: null },
  });

  await db.camion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
