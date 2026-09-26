// POST /api/bolson/cotizaciones/[id]/aceptar — cliente acepta cotización → crea servicio
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const cot = await bolsonDb.bolsonCotizacion.findUnique({
    where: { id },
    include: { solicitud: true },
  });
  if (!cot) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  if (cot.solicitud.clienteId !== user.id && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo el cliente puede aceptar cotizaciones" }, { status: 403 });
  }
  if (cot.estado !== "pendiente") {
    return NextResponse.json({ error: `La cotización ya está ${cot.estado}` }, { status: 400 });
  }
  if (cot.solicitud.estado !== "abierta") {
    return NextResponse.json({ error: "La solicitud no está abierta" }, { status: 400 });
  }

  // Crear servicio en transacción
  const servicio = await bolsonDb.$transaction(async (tx) => {
    // Marcar esta cotización como aceptada
    const aceptada = await tx.bolsonCotizacion.update({
      where: { id },
      data: { estado: "aceptada", aceptadaEn: new Date() },
    });

    // Marcar todas las demás cotizaciones de la solicitud como rechazadas
    await tx.bolsonCotizacion.updateMany({
      where: { solicitudId: cot.solicitudId, id: { not: id }, estado: "pendiente" },
      data: { estado: "rechazada", rechazadaRazon: "otra_cotizacion_aceptada" },
    });

    // Marcar la solicitud como adjudicada y en_progreso
    await tx.bolsonSolicitud.update({
      where: { id: cot.solicitudId },
      data: { estado: "en_progreso", cotizacionAdjudicadaId: id },
    });

    // Crear el servicio
    const serv = await tx.bolsonServicio.create({
      data: {
        solicitudId: cot.solicitudId,
        cotizacionId: id,
        transportistaId: cot.transportistaId,
        camionPatente: null,
        camionCapacidadKg: null,
        estado: "asignado",
        comisionMonto: 0,
      },
    });

    return serv;
  });

  // Notificar al transportista
  await bolsonNotificar(
    cot.transportistaId,
    "cotizacion_aceptada",
    "¡Cotización aceptada!",
    `Tu cotización de $${cot.monto} fue aceptada por ${user.nombre}. Iniciá el servicio desde tu panel.`,
    "/bolson/transportista",
    cot.solicitudId
  );

  return NextResponse.json({ ok: true, servicio });
}
