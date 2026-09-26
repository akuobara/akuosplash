// GET /api/bolson/notificaciones — lista notificaciones del usuario
import { NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET() {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const notifs = await bolsonDb.bolsonNotificacion.findMany({
    where: { usuarioId: user.id },
    orderBy: { creadoEn: "desc" },
    take: 50,
  });

  return NextResponse.json({ notificaciones: notifs });
}
