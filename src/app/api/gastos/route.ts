import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange } from "@/lib/helpers";

// GET /api/gastos
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "todo";
  const tipo = searchParams.get("tipo");
  const pagadoPor = searchParams.get("pagadoPor");
  const { start, end } = getRange(period);

  const where: Record<string, unknown> = {
    duenoId,
    AND: [
      start ? { fecha: { gte: start } } : {},
      end ? { fecha: { lt: end } } : {},
      tipo ? { tipo } : {},
      pagadoPor ? { pagadoPor } : {},
    ],
  };

  if (session.role === "chofer") {
    where.choferId = session.userId;
  }

  const gastos = await db.gasto.findMany({
    where,
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json({ gastos });
}

// POST /api/gastos
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    // Choferes siempre son "chofer" como pagador; solo el dueño puede registrar gastos pagados por él
    // Validar que pagadoPor es "chofer" o "dueno"
    let pagadoPor = session.role === "chofer" ? "chofer" : (body.pagadoPor || "chofer");
    if (pagadoPor !== "chofer" && pagadoPor !== "dueno") {
      pagadoPor = "chofer";
    }

    const nuevo = await db.gasto.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        tipo: body.tipo || "otro",
        monto: Number(body.monto) || 0,
        descripcion: body.descripcion?.trim() || null,
        fotoUrl: body.fotoUrl || null,
        pagadoPor,
        choferId: session.userId,
        duenoId,
      },
    });

    return NextResponse.json({ gasto: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el gasto" }, { status: 500 });
  }
}
