import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/gastos/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const actualizado = await db.gasto.update({
    where: { id },
    data: {
      ...(body.fecha !== undefined && { fecha: new Date(body.fecha) }),
      ...(body.tipo !== undefined && { tipo: body.tipo }),
      ...(body.monto !== undefined && { monto: Number(body.monto) || 0 }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion?.trim() || null }),
      ...(body.fotoUrl !== undefined && { fotoUrl: body.fotoUrl || null }),
    },
  });

  return NextResponse.json({ gasto: actualizado });
}

// DELETE /api/gastos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.gasto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
