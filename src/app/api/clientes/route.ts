import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/clientes
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clientes = await db.cliente.findMany({
    where: { duenoId },
    orderBy: { nombre: "asc" },
    include: { _count: { select: { entregas: true } } },
  });
  return NextResponse.json({ clientes });
}

// POST /api/clientes — solo dueño (los choferes no crean clientes)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo dueños pueden crear clientes" }, { status: 403 });
  }

  const body = await req.json();

  const nuevo = await db.cliente.create({
    data: {
      nombre: body.nombre?.trim() || "Sin nombre",
      direccion: body.direccion?.trim() || null,
      telefono: body.telefono?.trim() || null,
      zona: body.zona?.trim() || null,
      precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0,
      precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0,
      nota: body.nota?.trim() || null,
      duenoId: session.userId,
    },
  });

  return NextResponse.json({ cliente: nuevo }, { status: 201 });
}
