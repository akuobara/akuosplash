import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/superadmin/config
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  let config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config) {
    config = await akuosplashDb.akuoConfig.create({ data: {} });
  }
  return NextResponse.json({
    config: {
      comisionPorcentaje: config.comisionPorcentaje,
    },
  });
}

// PATCH /api/akuosplash/superadmin/config
export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const data: any = {};
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

  return NextResponse.json({
    ok: true,
    config: {
      comisionPorcentaje: config.comisionPorcentaje,
    },
  });
}
