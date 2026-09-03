import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { esVueltaCompletada } from "@/lib/helpers";
import { getRange } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const periodo = body.periodo || "semanal";
  const offset = Number(body.offset || 0);

  const config = await db.configuracion.findFirst({});
  if (!config) return NextResponse.json({ error: "no config" });

  const { start, end } = getRange(periodo);

  const vueltas = await db.vuelta.findMany({
    where: {
      duenoId: config.duenoId,
      iniciadaEn: { gte: start ?? undefined, lt: end ?? undefined },
    },
    include: {
      entregas: { select: { litros: true, total: true, montoEfectivo: true, montoTransferencia: true } },
      camion: { select: { nombre: true, capacidad: true } },
    },
    orderBy: { iniciadaEn: "asc" },
  });

  const detalle = vueltas.map(v => {
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    const cap = v.camion?.capacidad ?? config.capacidadCamion ?? 0;
    const umbral = config.umbralCompletacionVuelta ?? 0.975;
    const completada = esVueltaCompletada(litros, cap, v.entregas.length, umbral, (v as any).validadaManualmente);
    const umbralDefault = esVueltaCompletada(litros, cap, v.entregas.length, 0.975, (v as any).validadaManualmente);
    return {
      id: v.id,
      numero: v.numero,
      camion: v.camion?.nombre,
      litros,
      capacidad: cap,
      umbralConfig: umbral,
      umbralLitros: Math.ceil(cap * umbral),
      completadaConUmbralConfig: completada,
      completadaConUmbralDefault: umbralDefault,
      diferencia: completada !== umbralDefault,
    };
  });

  const validasConConfig = detalle.filter(d => d.completadaConUmbralConfig).length;
  const validasConDefault = detalle.filter(d => d.completadaConUmbralDefault).length;

  return NextResponse.json({
    ok: true,
    config: {
      umbralCompletacionVuelta: config.umbralCompletacionVuelta,
      modoLiquidacion: config.modoLiquidacion,
    },
    vueltas: detalle,
    resumen: {
      totalVueltas: detalle.length,
      validasConUmbralConfig: detalle.filter(d => d.completadaConUmbralConfig).length,
      validasConUmbralDefault: detalle.filter(d => d.completadaConUmbralDefault).length,
    },
  });
}
