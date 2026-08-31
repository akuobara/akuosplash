import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// PATCH /api/vueltas/[id]/validar — validar o invalidar vuelta manualmente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const validada = body.validada; // true, false, o null (auto)

  const vuelta = await db.vuelta.findUnique({ where: { id } });
  if (!vuelta) {
    return NextResponse.json({ error: "Vuelta no encontrada" }, { status: 404 });
  }

  const actualizada = await db.vuelta.update({
    where: { id },
    data: { validadaManualmente: validada },
  });

  return NextResponse.json({ vuelta: actualizada });
}
