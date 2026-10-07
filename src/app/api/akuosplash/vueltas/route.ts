import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/vueltas — lista de vueltas (con filtros: ?activa=true, ?cerradas=true, etc.)
// POST /api/akuosplash/vueltas — iniciar nueva vuelta
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const soloActivas = searchParams.get("activa") === "true";
  const soloCerradas = searchParams.get("cerradas") === "true";
  const limit = Number(searchParams.get("limit") || 20);

  const where: any = { transportistaId: user.id };
  if (soloActivas) where.activa = true;
  if (soloCerradas) where.cerradaEn = { not: null };

  const vueltas = await akuosplashDb.akuoVuelta.findMany({
    where,
    orderBy: { iniciadaEn: "desc" },
    take: limit,
    include: {
      vehiculo: { select: { id: true, patente: true, marca: true, modelo: true, capacidadLitros: true } },
      _count: { select: { entregas: true } },
    },
  });

  // Calcular litros y ventas por vuelta
  const vueltasConStats = await Promise.all(vueltas.map(async (v) => {
    const entregas = await akuosplashDb.akuoEntrega.findMany({
      where: { vueltaId: v.id },
      select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true },
    });
    return {
      id: v.id,
      numero: v.numero,
      iniciadaEn: v.iniciadaEn,
      cerradaEn: v.cerradaEn,
      nota: v.nota,
      activa: v.activa,
      vehiculo: v.vehiculo ? {
        id: v.vehiculo.id,
        nombre: `${v.vehiculo.marca || ""} ${v.vehiculo.modelo || ""}`.trim() || v.vehiculo.patente,
        patente: v.vehiculo.patente,
        capacidadLitros: v.vehiculo.capacidadLitros,
      } : null,
      litros: entregas.reduce((s, e) => s + e.litros, 0),
      ventas: entregas.reduce((s, e) => s + e.total, 0),
      efectivo: entregas.reduce((s, e) => s + (e.montoEfectivo || 0), 0),
      transferencia: entregas.reduce((s, e) => s + (e.montoTransferencia || 0), 0),
      numEntregas: entregas.length,
    };
  }));

  return NextResponse.json({ vueltas: vueltasConStats });
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  // Verificar que no haya otra vuelta activa
  const activa = await akuosplashDb.akuoVuelta.findFirst({
    where: { transportistaId: user.id, activa: true, cerradaEn: null },
  });
  if (activa) {
    return NextResponse.json({ error: "Ya tenés una vuelta activa. Cerrala antes de iniciar otra." }, { status: 400 });
  }

  // Calcular siguiente número de vuelta
  const ultima = await akuosplashDb.akuoVuelta.findFirst({
    where: { transportistaId: user.id },
    orderBy: { numero: "desc" },
  });
  const numero = (ultima?.numero || 0) + 1;

  const vuelta = await akuosplashDb.akuoVuelta.create({
    data: {
      numero,
      transportistaId: user.id,
      vehiculoId: body.vehiculoId || null,
      nota: body.nota || null,
    },
  });

  return NextResponse.json({ ok: true, vuelta }, { status: 201 });
}
