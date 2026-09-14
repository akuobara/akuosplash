// Endpoint TEMPORAL para migrar las nuevas columnas de Camion y BitacoraCamion.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const results: { column: string; status: string; error?: string }[] = [];

  const columnas: [string, string][] = [
    ["Camion", "carroceria TEXT"],
    ["Camion", "tipoCisterna TEXT"],
    ["Camion", "materialEstanque TEXT"],
    ["Camion", "tipoAgua TEXT"],
    ["Camion", "resolucionSanitaria TEXT"],
    ["Camion", "resolucionSanitariaVencimiento DATETIME"],
    ["Camion", "resolucionSanitariaFotoUrl TEXT"],
    ["BitacoraCamion", "monto REAL"],
    ["BitacoraCamion", "fecha DATETIME"],
    ["BitacoraCamion", "kilometraje INTEGER"],
  ];

  for (const [tabla, definicion] of columnas) {
    const nombreCol = definicion.split(" ")[0];
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "${tabla}" ADD COLUMN "${nombreCol}" ${definicion.split(" ").slice(1).join(" ")};`);
      results.push({ column: `${tabla}.${nombreCol}`, status: "agregada" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        results.push({ column: `${tabla}.${nombreCol}`, status: "ya existía" });
      } else {
        results.push({ column: `${tabla}.${nombreCol}`, status: "error", error: msg });
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function POST(_req: NextRequest) { return ejecutar(); }
export async function GET(req: NextRequest) { return ejecutar(); }
