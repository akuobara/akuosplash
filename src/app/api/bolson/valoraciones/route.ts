// POST /api/bolson/valoraciones — crear valoración
// Body: { servicioId, rating (1-5), comentario? }
// El "aUsuario" se determina automáticamente: si el que valora es cliente → transportista, y viceversa.
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function POST(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const servicioId = body.servicioId;
  const rating = Number(body.rating);
  const comentario = body.comentario?.trim() || null;

  if (!servicioId) return NextResponse.json({ error: "servicioId es obligatorio" }, { status: 400 });
  if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: "rating debe estar entre 1 y 5" }, { status: 400 });

  const serv = await bolsonDb.bolsonServicio.findUnique({
    where: { id: servicioId },
    include: { solicitud: { select: { clienteId: true } } },
  });
  if (!serv) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  if (serv.estado !== "completado" && serv.estado !== "entregado") {
    return NextResponse.json({ error: "Solo podés valorar servicios completados" }, { status: 400 });
  }

  // Determinar de→a
  let deUsuarioId = user.id;
  let aUsuarioId: string;
  if (user.id === serv.solicitud.clienteId) {
    aUsuarioId = serv.transportistaId;
  } else if (user.id === serv.transportistaId || user.id === serv.choferId) {
    aUsuarioId = serv.solicitud.clienteId;
  } else if (user.rol === "superadmin") {
    return NextResponse.json({ error: "Superadmin no puede valorar" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // No permitir valoración duplicada (unique constraint)
  const existente = await bolsonDb.bolsonValoracion.findUnique({
    where: {
      servicioId_deUsuarioId_aUsuarioId: { servicioId, deUsuarioId, aUsuarioId },
    },
  });
  if (existente) return NextResponse.json({ error: "Ya valoraste este servicio" }, { status: 400 });

  const val = await bolsonDb.bolsonValoracion.create({
    data: { servicioId, deUsuarioId, aUsuarioId, rating, comentario },
  });

  await bolsonNotificar(
    aUsuarioId,
    "valoracion_recibida",
    "Nueva valoración recibida",
    `Recibiste ${rating} estrella(s)${comentario ? `: "${comentario.slice(0, 80)}"` : ""}.`,
    "/bolson",
    serv.solicitudId
  );

  return NextResponse.json({ valoracion: val }, { status: 201 });
}
