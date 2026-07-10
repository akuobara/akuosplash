import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange } from "@/lib/helpers";

// GET /api/gastos?period=hoy|semana|mes|todo&tipo=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "todo";
  const tipo = searchParams.get("tipo");

  const { start, end } = getRange(period);

  const gastos = await db.gasto.findMany({
    where: {
      AND: [
        start ? { fecha: { gte: start } } : {},
        end ? { fecha: { lt: end } } : {},
        tipo ? { tipo } : {},
      ],
    },
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json({ gastos });
}

// POST /api/gastos
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const nuevo = await db.gasto.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        tipo: body.tipo || "otro",
        monto: Number(body.monto) || 0,
        descripcion: body.descripcion?.trim() || null,
        fotoUrl: body.fotoUrl || null,
      },
    });

    return NextResponse.json({ gasto: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el gasto" }, { status: 500 });
  }
}
