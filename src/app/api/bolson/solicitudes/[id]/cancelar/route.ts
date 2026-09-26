// POST /api/bolson/solicitudes/[id]/cancelar
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const razon = body.razon?.trim() || null;

  const sol = await bolsonDb.bolsonSolicitud.findUnique({
    where: { id },
    include: { cotizaciones: true },
  });
  if (!sol) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (sol.clienteId !== user.id && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo el cliente o el superadmin puede cancelar" }, { status: 403 });
  }
  if (sol.estado === "cancelada") return NextResponse.json({ error: "Ya está cancelada" }, { status: 400 });
  if (sol.estado === "en_progreso" || sol.estado === "entregada") {
    return NextResponse.json({ error: "No se puede cancelar una solicitud en progreso o entregada" }, { status: 400 });
  }

  await bolsonDb.bolsonSolicitud.update({
    where: { id },
    data: { estado: "cancelada", canceladaRazon: razon, cerradaEn: new Date() },
  });

  // Notificar a transportistas que cotizaron
  const cotizantes = [...new Set(sol.cotizaciones.map((c) => c.transportistaId))];
  for (const tid of cotizantes) {
    await bolsonNotificar(tid, "solicitud_cancelada", "Solicitud cancelada", `La solicitud "${sol.titulo}" fue cancelada.`, "/bolson/transportista", id);
    // Marcar cotizaciones como rechazadas
    await bolsonDb.bolsonCotizacion.updateMany({
      where: { solicitudId: id, transportistaId: tid, estado: "pendiente" },
      data: { estado: "rechazada", rechazadaRazon: "solicitud_cancelada" },
    });
  }

  return NextResponse.json({ ok: true });
}
