import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPeriodRange } from "@/lib/akuosplash-period";

// GET /api/akuosplash/gastos?period=hoy — lista de gastos del transportista
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "hoy";
  const { start, end } = getPeriodRange(period);

  const gastos = await akuosplashDb.akuoGasto.findMany({
    where: {
      transportistaId: user.id,
      fecha: { gte: start, lte: end },
    },
    orderBy: { fecha: "desc" },
    take: period === "todo" ? 500 : 100,
  });

  return NextResponse.json({ gastos });
}

// POST /api/akuosplash/gastos — crear nuevo gasto
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.tipo?.trim()) return NextResponse.json({ error: "Tipo de gasto obligatorio" }, { status: 400 });
  if (!body.monto || Number(body.monto) <= 0) return NextResponse.json({ error: "Monto obligatorio" }, { status: 400 });

  // Si hay vuelta activa, asociar el gasto a ella
  let vueltaId: string | null = body.vueltaId || null;
  if (!vueltaId) {
    const vueltaActiva = await akuosplashDb.akuoVuelta.findFirst({
      where: { transportistaId: user.id, activa: true, cerradaEn: null },
    });
    if (vueltaActiva) vueltaId = vueltaActiva.id;
  }

  const gasto = await akuosplashDb.akuoGasto.create({
    data: {
      transportistaId: user.id,
      tipo: body.tipo.trim(),
      monto: Number(body.monto),
      descripcion: body.descripcion || null,
      metodoPago: body.metodoPago || "efectivo",
      vueltaId,
    },
  });

  return NextResponse.json({ ok: true, gasto }, { status: 201 });
}
