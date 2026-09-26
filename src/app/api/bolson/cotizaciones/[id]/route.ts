// PATCH /api/bolson/cotizaciones/[id] — editar cotización (cambiar monto/mensaje)
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const cot = await bolsonDb.bolsonCotizacion.findUnique({ where: { id } });
  if (!cot) return NextResponse.json({ error: "Cotización no encontrada" }, { status: 404 });
  if (cot.transportistaId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (cot.estado !== "pendiente") return NextResponse.json({ error: "No podés editar una cotización ya procesada" }, { status: 400 });

  const data: any = {};
  if (body.monto !== undefined) data.monto = Number(body.monto);
  if (body.mensaje !== undefined) data.mensaje = body.mensaje?.trim() || null;
  if (body.tiempoEstimadoHoras !== undefined) data.tiempoEstimadoHoras = Number(body.tiempoEstimadoHoras) || null;
  if (body.fechaPropuestaInicio !== undefined) data.fechaPropuestaInicio = body.fechaPropuestaInicio ? new Date(body.fechaPropuestaInicio) : null;
  if (body.fechaPropuestaFin !== undefined) data.fechaPropuestaFin = body.fechaPropuestaFin ? new Date(body.fechaPropuestaFin) : null;
  if (body.incluyePersonal !== undefined) data.incluyePersonal = !!body.incluyePersonal;
  if (body.incluyeEmbalaje !== undefined) data.incluyeEmbalaje = !!body.incluyeEmbalaje;
  if (body.incluyeGrua !== undefined) data.incluyeGrua = !!body.incluyeGrua;
  if (body.incluyeMotoneta !== undefined) data.incluyeMotoneta = !!body.incluyeMotoneta;

  const actualizada = await bolsonDb.bolsonCotizacion.update({ where: { id }, data });
  return NextResponse.json({ cotizacion: actualizada });
}
