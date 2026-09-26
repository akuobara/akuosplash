// POST /api/bolson/cotizaciones/[id]/retirar — transportista retira su cotización
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const cot = await bolsonDb.bolsonCotizacion.findUnique({ where: { id }, include: { solicitud: true } });
  if (!cot) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  if (cot.transportistaId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (cot.estado !== "pendiente") return NextResponse.json({ error: "No podés retirar una cotización ya procesada" }, { status: 400 });

  await bolsonDb.bolsonCotizacion.update({
    where: { id },
    data: { estado: "retirada" },
  });

  // Notificar al cliente
  await bolsonNotificar(
    cot.solicitud.clienteId,
    "cotizacion_retirada",
    "Cotización retirada",
    `${user.nombre} retiró su cotización para tu solicitud "${cot.solicitud.titulo}".`,
    "/bolson/cliente",
    cot.solicitudId
  );

  return NextResponse.json({ ok: true });
}
