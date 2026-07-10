import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/vueltas/[id]/cerrar — cierra la vuelta activa (marca como no activa)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const vuelta = await db.vuelta.update({
      where: { id },
      data: { activa: false, cerradaEn: new Date() },
    });
    return NextResponse.json({ vuelta });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo cerrar la vuelta" }, { status: 500 });
  }
}
