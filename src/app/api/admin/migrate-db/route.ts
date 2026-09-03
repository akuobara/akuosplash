import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/migrate-db
// Endpoint temporal para agregar columna precioCamionCompleto a la DB de producción.
// Se elimina después de usar.
export async function POST(req: NextRequest) {
  // Protección simple con shared secret
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== "aljibe-migrate-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];

  // 1. Agregar columna a Cliente
  try {
    await db.$executeRawUnsafe(
      `ALTER TABLE "Cliente" ADD COLUMN "precioCamionCompleto" REAL NOT NULL DEFAULT 0`
    );
    resultados.push("Cliente.precioCamionCompleto: columna agregada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      resultados.push("Cliente.precioCamionCompleto: ya existía (ok)");
    } else {
      resultados.push(`Cliente.precioCamionCompleto: ERROR: ${msg}`);
    }
  }

  // 2. Agregar columna a Configuracion
  try {
    await db.$executeRawUnsafe(
      `ALTER TABLE "Configuracion" ADD COLUMN "precioCamionCompleto" REAL NOT NULL DEFAULT 0`
    );
    resultados.push("Configuracion.precioCamionCompleto: columna agregada");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      resultados.push("Configuracion.precioCamionCompleto: ya existía (ok)");
    } else {
      resultados.push(`Configuracion.precioCamionCompleto: ERROR: ${msg}`);
    }
  }

  return NextResponse.json({
    ok: true,
    resultados,
    timestamp: new Date().toISOString(),
  });
}
