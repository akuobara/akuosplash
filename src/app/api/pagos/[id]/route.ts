import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// PATCH /api/pagos/[id] — editar monto, método de pago, quién lo recibió
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const pago = await db.pago.findUnique({ where: { id } });
  if (!pago) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const duenoId = session.role === "dueno" ? session.userId : session.duenoId;
  if (pago.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Chofer: solo puede editar pagos que él registró
  if (session.role === "chofer" && pago.choferId !== session.userId) {
    return NextResponse.json({ error: "Solo puedes editar pagos que tú registraste" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.monto !== undefined) {
    const monto = Number(body.monto);
    if (monto <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 });
    }
    data.monto = monto;
  }
  if (body.metodoPago !== undefined) {
    if (!["efectivo", "transferencia", "mixto", "credito"].includes(body.metodoPago)) {
      return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });
    }
    data.metodoPago = body.metodoPago;
  }
  if (body.nota !== undefined) {
    data.nota = body.nota?.trim() || null;
  }
  if (body.descripcion !== undefined) {
    data.descripcion = body.descripcion?.trim() || null;
  }
  // Cambiar quién recibió el pago (solo el dueño puede hacer esto)
  if (body.choferId !== undefined && session.role === "dueno") {
    // null = lo recibió el admin; un userId = lo recibió ese chofer
    data.choferId = body.choferId || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
  }

  const actualizado = await db.pago.update({
    where: { id },
    data,
    include: { cliente: { select: { id: true, nombre: true } } },
  });

  return NextResponse.json({ pago: actualizado });
}

// DELETE /api/pagos/[id] — choferes solo pueden borrar sus propios pagos
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const pago = await db.pago.findUnique({ where: { id } });
  if (!pago) {
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
  }

  const duenoId = session.role === "dueno" ? session.userId : session.duenoId;
  if (pago.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Chofer: solo puede borrar pagos que él registró
  if (session.role === "chofer" && pago.choferId !== session.userId) {
    return NextResponse.json({ error: "Solo puedes borrar pagos que tú registraste" }, { status: 403 });
  }

  await db.pago.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
