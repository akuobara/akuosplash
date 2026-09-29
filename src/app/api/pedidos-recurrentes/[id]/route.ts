import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// PATCH /api/pedidos-recurrentes/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const recurrente = await db.pedidoRecurrente.findUnique({ where: { id } });
  if (!recurrente) {
    return NextResponse.json({ error: "Recurrencia no encontrada" }, { status: 404 });
  }

  // Autorización:
  // - Dueño: debe ser el dueño del recurrente.
  // - Chofer: debe estar asignado a esta recurrencia (choferAsignadoId === session.userId).
  if (session.role === "dueno") {
    if (recurrente.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (session.role === "chofer") {
    if (!recurrente.choferAsignadoId || recurrente.choferAsignadoId !== session.userId) {
      return NextResponse.json(
        { error: "Solo podés editar pedidos recurrentes asignados a ti." },
        { status: 403 }
      );
    }
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (body.litrosSolicitados !== undefined) data.litrosSolicitados = Number(body.litrosSolicitados) || 0;
  if (body.metodoPagoPreferido !== undefined) data.metodoPagoPreferido = body.metodoPagoPreferido;
  if (body.nota !== undefined) data.nota = body.nota?.trim() || null;
  if (body.frecuenciaDias !== undefined) data.frecuenciaDias = Number(body.frecuenciaDias) || 1;
  if (body.activo !== undefined) data.activo = !!body.activo;
  if (body.asignacionTipo !== undefined) data.asignacionTipo = body.asignacionTipo;
  if (body.choferAsignadoId !== undefined) data.choferAsignadoId = (body.choferAsignadoId && body.choferAsignadoId !== "__ninguno") ? body.choferAsignadoId : null;
  if (body.fechaProximaGeneracion !== undefined) {
    data.fechaProximaGeneracion = body.fechaProximaGeneracion ? new Date(body.fechaProximaGeneracion) : undefined;
  }
  // Día de la semana preferido (solo para frecuencia 7 = semanal)
  // Si se setea/cambia, recalcula fechaProximaGeneracion al próximo día preferido
  if (body.diaSemanaPreferido !== undefined) {
    const dia = body.diaSemanaPreferido === null || body.diaSemanaPreferido === "" || body.diaSemanaPreferido === undefined
      ? null
      : Number(body.diaSemanaPreferido);
    if (dia !== null && (dia < 0 || dia > 6 || isNaN(dia))) {
      return NextResponse.json({ error: "diaSemanaPreferido debe ser 0-6 (domingo a sábado) o null" }, { status: 400 });
    }
    data.diaSemanaPreferido = dia;
    // Si se setea un día preferido y la frecuencia es 7, recalcular fechaProximaGeneracion
    const nuevaFrec = body.frecuenciaDias !== undefined ? Number(body.frecuenciaDias) : recurrente.frecuenciaDias;
    if (dia !== null && nuevaFrec === 7) {
      // Snap al próximo día preferido desde HOY
      const hoy = new Date();
      hoy.setUTCHours(0, 0, 0, 0);
      const diaActual = hoy.getDay();
      let diff = (dia - diaActual + 7) % 7;
      if (diff === 0) diff = 7; // si hoy es el día preferido, ir al próximo (no hoy)
      const nuevaFecha = new Date(hoy);
      nuevaFecha.setDate(hoy.getDate() + diff);
      data.fechaProximaGeneracion = nuevaFecha;
    } else if (dia === null) {
      // Si se quita el día preferido, no tocar fechaProximaGeneracion (queda como está)
    }
  }

  const actualizado = await db.pedidoRecurrente.update({ where: { id }, data });
  return NextResponse.json({ recurrente: actualizado });
}

// DELETE /api/pedidos-recurrentes/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const recurrente = await db.pedidoRecurrente.findUnique({ where: { id } });
  if (!recurrente) {
    return NextResponse.json({ error: "Recurrencia no encontrada" }, { status: 404 });
  }

  // Autorización:
  // - Dueño: debe ser el dueño del recurrente.
  // - Chofer: debe estar asignado a esta recurrencia (choferAsignadoId === session.userId).
  if (session.role === "dueno") {
    if (recurrente.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (session.role === "chofer") {
    if (!recurrente.choferAsignadoId || recurrente.choferAsignadoId !== session.userId) {
      return NextResponse.json(
        { error: "Solo podés eliminar pedidos recurrentes asignados a ti." },
        { status: 403 }
      );
    }
  } else {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await db.pedidoRecurrente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
