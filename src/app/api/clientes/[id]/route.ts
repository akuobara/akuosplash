import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkOwnership(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  if (session.role !== "dueno") return { error: NextResponse.json({ error: "Solo dueños" }, { status: 403 }), session: null };

  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente || cliente.duenoId !== session.userId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await checkOwnership(await params.then(p => p.id));
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();

  const actualizado = await db.cliente.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre.trim() }),
      ...(body.direccion !== undefined && { direccion: body.direccion?.trim() || null }),
      ...(body.telefono !== undefined && { telefono: body.telefono?.trim() || null }),
      ...(body.zona !== undefined && { zona: body.zona?.trim() || null }),
      ...(body.precioEfectivoPorLitro !== undefined && { precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0 }),
      ...(body.precioTransferenciaPorLitro !== undefined && { precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0 }),
      ...(body.nota !== undefined && { nota: body.nota?.trim() || null }),
    },
  });

  return NextResponse.json({ cliente: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await checkOwnership(await params.then(p => p.id));
  if (authError) return authError;

  const { id } = await params;
  await db.cliente.update({
    where: { id },
    data: { entregas: { set: [] } },
  });
  await db.cliente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
