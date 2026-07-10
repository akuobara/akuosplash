import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/clientes
export async function GET() {
  const clientes = await db.cliente.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { entregas: true } },
    },
  });
  return NextResponse.json({ clientes });
}

// POST /api/clientes
export async function POST(req: NextRequest) {
  const body = await req.json();

  const nuevo = await db.cliente.create({
    data: {
      nombre: body.nombre?.trim() || "Sin nombre",
      direccion: body.direccion?.trim() || null,
      telefono: body.telefono?.trim() || null,
      precioPorLitro: Number(body.precioPorLitro) || 0,
      nota: body.nota?.trim() || null,
    },
  });

  return NextResponse.json({ cliente: nuevo }, { status: 201 });
}
