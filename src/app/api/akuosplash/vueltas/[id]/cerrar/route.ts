import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/vueltas/[id]/cerrar — cerrar vuelta activa
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { id } = await params;
  const vuelta = await akuosplashDb.akuoVuelta.findUnique({ where: { id } });
  if (!vuelta) return NextResponse.json({ error: "Vuelta no encontrada" }, { status: 404 });
  if (vuelta.transportistaId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (vuelta.cerradaEn) {
    return NextResponse.json({ error: "La vuelta ya está cerrada" }, { status: 400 });
  }

  const actualizada = await akuosplashDb.akuoVuelta.update({
    where: { id },
    data: { cerradaEn: new Date(), activa: false },
  });

  return NextResponse.json({ ok: true, vuelta: actualizada });
}
