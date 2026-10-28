import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/liquidacion/cerrar — cerrar período de liquidación
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  // Por ahora, solo cerrar todas las vueltas del transportista que estén activas
  const body = await req.json().catch(() => ({}));
  const vueltasActivas = await akuosplashDb.akuoVuelta.findMany({
    where: { transportistaId: user.id, activa: true, cerradaEn: null },
  });
  for (const v of vueltasActivas) {
    await akuosplashDb.akuoVuelta.update({ where: { id: v.id }, data: { cerradaEn: new Date(), activa: false } });
  }
  return NextResponse.json({ ok: true, cerradas: vueltasActivas.length });
}
