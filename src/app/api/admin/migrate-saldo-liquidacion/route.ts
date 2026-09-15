import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Configuracion" ADD COLUMN "saldoPendienteLiquidacion" REAL NOT NULL DEFAULT 0;`);
    return NextResponse.json({ ok: true, message: "Columna saldoPendienteLiquidacion agregada" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column name") || msg.includes("already exists")) {
      return NextResponse.json({ ok: true, message: "Ya existía" });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
export async function POST(_req: NextRequest) { return ejecutar(); }
export async function GET(req: NextRequest) { return ejecutar(); }
