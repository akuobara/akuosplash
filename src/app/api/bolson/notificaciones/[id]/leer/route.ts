// POST /api/bolson/notificaciones/[id]/leer — marcar como leída
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { id } = await params;
  const n = await bolsonDb.bolsonNotificacion.findUnique({ where: { id } });
  if (!n) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (n.usuarioId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  await bolsonDb.bolsonNotificacion.update({ where: { id }, data: { leidaEn: new Date() } });
  return NextResponse.json({ ok: true });
}
