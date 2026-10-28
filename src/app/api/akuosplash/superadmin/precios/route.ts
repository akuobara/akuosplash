import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/superadmin/precios
// Devuelve: config (precioPorLitroAguaDefault, comisionPorcentaje) + lista de precios por zona
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  let config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config) {
    config = await akuosplashDb.akuoConfig.create({ data: {} });
  }
  const zonas = await akuosplashDb.akuoZonaPrecio.findMany({
    where: { activo: true },
    orderBy: { comuna: "asc" },
  });

  return NextResponse.json({
    config: {
      precioPorLitroAguaDefault: config.precioPorLitroAguaDefault,
      comisionPorcentaje: config.comisionPorcentaje,
    },
    zonas,
  });
}

// PATCH /api/akuosplash/superadmin/precios
// Actualiza el precio default y la comisión
export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const data: any = {};
  if (body.precioPorLitroAguaDefault !== undefined) {
    const v = Number(body.precioPorLitroAguaDefault);
    if (isNaN(v) || v < 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
    data.precioPorLitroAguaDefault = v;
  }
  if (body.comisionPorcentaje !== undefined) {
    const v = Number(body.comisionPorcentaje);
    if (isNaN(v) || v < 0 || v > 100) return NextResponse.json({ error: "Comisión inválida (0-100)" }, { status: 400 });
    data.comisionPorcentaje = v;
  }

  let config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config) {
    config = await akuosplashDb.akuoConfig.create({ data: { ...data } });
  } else {
    config = await akuosplashDb.akuoConfig.update({ where: { id: config.id }, data });
  }

  return NextResponse.json({ ok: true, config: { precioPorLitroAguaDefault: config.precioPorLitroAguaDefault, comisionPorcentaje: config.comisionPorcentaje } });
}

// POST /api/akuosplash/superadmin/precios
// Crea un nuevo precio por zona
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const comuna = body.comuna?.trim();
  if (!comuna) return NextResponse.json({ error: "Comuna obligatoria" }, { status: 400 });
  const precio = Number(body.precioPorLitro);
  if (isNaN(precio) || precio < 0) return NextResponse.json({ error: "Precio inválido" }, { status: 400 });

  const existente = await akuosplashDb.akuoZonaPrecio.findUnique({ where: { comuna } });
  let zona;
  if (existente) {
    zona = await akuosplashDb.akuoZonaPrecio.update({
      where: { id: existente.id },
      data: { precioPorLitro: precio, activo: true },
    });
  } else {
    zona = await akuosplashDb.akuoZonaPrecio.create({
      data: { comuna, precioPorLitro: precio },
    });
  }

  return NextResponse.json({ ok: true, zona }, { status: 201 });
}
