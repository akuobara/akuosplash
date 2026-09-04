import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== "aljibe-migrate-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];

  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Pedido" ADD COLUMN "franjaHoraria" TEXT`);
    resultados.push("Pedido.franjaHoraria: columna agregada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      resultados.push("Pedido.franjaHoraria: ya existía (ok)");
    } else {
      resultados.push(`ERROR: ${msg}`);
    }
  }

  return NextResponse.json({ ok: true, resultados, timestamp: new Date().toISOString() });
}
