import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const configs = await db.configuracion.findMany({
    select: {
      id: true, duenoId: true, umbralCompletacionVuelta: true,
      modoLiquidacion: true, capacidadCamion: true,
      montoPorVueltaUnicoCliente: true, montoPorVueltaMultiple: true,
    },
  });

  return NextResponse.json({
    ok: true,
    configs,
    timestamp: new Date().toISOString(),
  });
}
