// Endpoint TEMPORAL para agregar la columna isDemo a la tabla Usuario en producción.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;`);
    return NextResponse.json({ ok: true, message: "Columna isDemo agregada a Usuario" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column name") || msg.includes("already exists")) {
      return NextResponse.json({ ok: true, message: "La columna isDemo ya existía" });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
