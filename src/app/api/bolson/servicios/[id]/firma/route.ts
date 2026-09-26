// POST /api/bolson/servicios/[id]/firma — registrar firma del cliente (URL base64 del trazo)
// Body: { firmaUrl }
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const firmaUrl = body.firmaUrl;
  if (!firmaUrl) return NextResponse.json({ error: "firmaUrl es obligatoria" }, { status: 400 });

  const serv = await bolsonDb.bolsonServicio.findUnique({
    where: { id },
    include: { solicitud: { select: { clienteId: true, titulo: true } } },
  });
  if (!serv) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  // Solo el cliente puede firmar
  if (serv.solicitud.clienteId !== user.id && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo el cliente puede firmar la entrega" }, { status: 403 });
  }

  await bolsonDb.bolsonServicio.update({
    where: { id },
    data: { firmaClienteUrl: firmaUrl, firmaClienteEn: new Date(), estado: "completado", completadoEn: new Date() },
  });
  await bolsonDb.bolsonSolicitud.update({
    where: { id: serv.solicitudId },
    data: { estado: "entregada", cerradaEn: new Date() },
  });

  // Notificar al transportista
  await bolsonNotificar(
    serv.transportistaId,
    "servicio_completado",
    "Servicio completado y firmado",
    `El cliente firmó la entrega del servicio "${serv.solicitud.titulo}". El servicio fue completado.`,
    "/bolson/transportista",
    serv.solicitudId
  );

  return NextResponse.json({ ok: true });
}
