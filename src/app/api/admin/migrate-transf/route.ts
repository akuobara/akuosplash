import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== "aljibe-migrate-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const resultados: string[] = [];

  const columnas = [
    { name: "transfBanco", type: "TEXT" },
    { name: "transfTipoCuenta", type: "TEXT" },
    { name: "transfNumeroCuenta", type: "TEXT" },
    { name: "transfTitular", type: "TEXT" },
    { name: "transfRutTitular", type: "TEXT" },
    { name: "transfEmail", type: "TEXT" },
    { name: "transfTelefono", type: "TEXT" },
  ];

  for (const col of columnas) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Configuracion" ADD COLUMN "${col.name}" ${col.type}`);
      resultados.push(`${col.name}: columna agregada`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column") || msg.includes("already exists")) {
        resultados.push(`${col.name}: ya existía (ok)`);
      } else {
        resultados.push(`${col.name}: ERROR: ${msg}`);
      }
    }
  }

  return NextResponse.json({ ok: true, resultados, timestamp: new Date().toISOString() });
}
