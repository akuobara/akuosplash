// GET /api/bolson/categorias — lista categorías activas
import { NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";

export async function GET() {
  try {
    const cats = await bolsonDb.bolsonCategoria.findMany({
      where: { activo: true },
      orderBy: { orden: "asc" },
    });
    return NextResponse.json({ categorias: cats });
  } catch (e: any) {
    console.error("Bolson categorias error:", e?.message || String(e), e?.stack || "");
    return NextResponse.json(
      { error: "No se pudieron cargar categorías", detalle: e?.message || String(e) },
      { status: 500 }
    );
  }
}
