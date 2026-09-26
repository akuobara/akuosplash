// GET /api/bolson/mensajes?solicitudId=... — lista mensajes de una solicitud
// POST /api/bolson/mensajes — envía un mensaje (solo participantes de la solicitud)
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function GET(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const solicitudId = searchParams.get("solicitudId");
  if (!solicitudId) return NextResponse.json({ error: "solicitudId es obligatorio" }, { status: 400 });

  // Verificar acceso
  const sol = await bolsonDb.bolsonSolicitud.findUnique({
    where: { id: solicitudId },
    include: { cotizaciones: { select: { transportistaId: true } } },
  });
  if (!sol) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  const esCliente = sol.clienteId === user.id;
  const esTransportistaCotizante = sol.cotizaciones.some((c) => c.transportistaId === user.id);
  const esSuperadmin = user.rol === "superadmin";
  const permitido = sol.estado === "abierta"
    ? (esCliente || esTransportistaCotizante || (user.rol === "transportista" && user.aprobado) || esSuperadmin)
    : (esCliente || esTransportistaCotizante || esSuperadmin);
  if (!permitido) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const mensajes = await bolsonDb.bolsonMensaje.findMany({
    where: { solicitudId },
    orderBy: { creadoEn: "asc" },
    include: { remitente: { select: { id: true, nombre: true } } },
    take: 200,
  });

  return NextResponse.json({ mensajes });
}

export async function POST(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const solicitudId = body.solicitudId;
  const contenido = body.contenido?.trim();
  if (!solicitudId || !contenido) return NextResponse.json({ error: "solicitudId y contenido son obligatorios" }, { status: 400 });

  const sol = await bolsonDb.bolsonSolicitud.findUnique({
    where: { id: solicitudId },
    include: { cotizaciones: { select: { transportistaId: true } } },
  });
  if (!sol) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  const esCliente = sol.clienteId === user.id;
  const esTransportistaCotizante = sol.cotizaciones.some((c) => c.transportistaId === user.id);
  if (!esCliente && !esTransportistaCotizante && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo participantes pueden enviar mensajes" }, { status: 403 });
  }

  const msg = await bolsonDb.bolsonMensaje.create({
    data: { solicitudId, remitenteId: user.id, contenido, tipo: body.tipo || "texto", metadata: body.metadata || null },
    include: { remitente: { select: { id: true, nombre: true } } },
  });

  // Notificar al otro lado
  const destinatarioId = esCliente
    ? (sol.cotizaciones[0]?.transportistaId || null)
    : sol.clienteId;
  if (destinatarioId) {
    await bolsonNotificar(
      destinatarioId,
      "nuevo_mensaje",
      "Nuevo mensaje",
      `${user.nombre}: ${contenido.slice(0, 100)}`,
      esCliente ? "/bolson/transportista" : "/bolson/cliente",
      solicitudId
    );
  }

  return NextResponse.json({ mensaje: msg }, { status: 201 });
}
