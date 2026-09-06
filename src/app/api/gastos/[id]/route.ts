import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

async function checkOwnership(id: string) {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };
  const duenoId = await getDuenoId();
  if (!duenoId) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }), session: null };

  const gasto = await db.gasto.findUnique({ where: { id } });
  if (!gasto || gasto.duenoId !== duenoId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }
  if (session.role === "chofer" && gasto.choferId !== session.userId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const { error: authError, session } = await checkOwnership(await params.then(p => p.id));
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();

  // Choferes no pueden cambiar pagadoPor a "dueno"; validar enum
  let pagadoPorFinal = body.pagadoPor;
  if (pagadoPorFinal !== undefined) {
    if (pagadoPorFinal !== "chofer" && pagadoPorFinal !== "dueno") {
      pagadoPorFinal = "chofer";
    }
    if (session?.role === "chofer" && pagadoPorFinal === "dueno") {
      pagadoPorFinal = "chofer";
    }
  }

  const actualizado = await db.gasto.update({
    where: { id },
    data: {
      ...(body.fecha !== undefined && { fecha: new Date(body.fecha) }),
      ...(body.tipo !== undefined && { tipo: body.tipo }),
      ...(body.monto !== undefined && { monto: Number(body.monto) || 0 }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion?.trim() || null }),
      ...(body.fotoUrl !== undefined && { fotoUrl: body.fotoUrl || null }),
      ...(body.pagadoPor !== undefined && { pagadoPor: pagadoPorFinal }),
    },
  });

  return NextResponse.json({ gasto: actualizado });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const { error: authError } = await checkOwnership(await params.then(p => p.id));
  if (authError) return authError;

  const { id } = await params;
  await db.gasto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
