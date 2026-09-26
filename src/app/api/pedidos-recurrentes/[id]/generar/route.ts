import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/pedidos-recurrentes/[id]/generar
// Genera un pedido a partir de un pedido recurrente.
// Body: { automatico?: boolean } — si true, es llamado por el sistema (cron futuro)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Si es automático (sin sesión), verificar que el recurrente existe y está activo
  // Por ahora solo permitimos con sesión
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const recurrente = await db.pedidoRecurrente.findUnique({
    where: { id },
    include: { cliente: true },
  });

  if (!recurrente) {
    return NextResponse.json({ error: "Pedido recurrente no encontrado" }, { status: 404 });
  }

  if (session.role === "dueno" && recurrente.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // Chofer: verificar que el recurrente pertenece a su dueño
  if (session.role === "chofer" && recurrente.duenoId !== session.duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Idempotencia: si ya existe un pedido generado hoy para este recurrente, no crear otro
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const existente = await db.pedido.findFirst({
    where: {
      pedidoRecurrenteId: recurrente.id,
      creadoEn: { gte: hoy },
    },
  });
  if (existente) {
    return NextResponse.json({ pedido: existente, proximaGeneracion: recurrente.fechaProximaGeneracion, yaExistente: true });
  }

  if (!recurrente.activo) {
    return NextResponse.json({ error: "El pedido recurrente está inactivo" }, { status: 400 });
  }

  const cliente = recurrente.cliente;

  // Crear el pedido con los datos del recurrente y del cliente.
  // Importante: fechaSolicitada = recurrente.fechaProximaGeneracion (igual que el cron),
  // para que el pedido quede programado para la fecha correcta y no "pendiente sin fecha".
  const nuevoPedido = await db.pedido.create({
    data: {
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteDireccion: cliente.direccion,
      clienteTelefono: cliente.telefono,
      clienteZona: cliente.zona,
      clienteLat: cliente.lat,
      clienteLng: cliente.lng,
      indicacionesAcceso: cliente.indicacionesAcceso,
      litrosSolicitados: recurrente.litrosSolicitados,
      fechaSolicitada: recurrente.fechaProximaGeneracion, // ← antes no se seteba, dejaba null
      metodoPagoPreferido: recurrente.metodoPagoPreferido,
      nota: recurrente.nota,
      estado: "programado", // ← antes "pendiente"; ahora programado con fecha
      choferId: session.role === "chofer" ? session.userId : null,
      duenoId: recurrente.duenoId,
      asignacionTipo: recurrente.asignacionTipo,
      choferAsignadoId: recurrente.choferAsignadoId,
      publicadoEn: recurrente.asignacionTipo === "publicado" ? new Date() : null,
      prioridadChoferId: cliente.choferPreferidoId,
      prioridadTipo: cliente.choferPreferidoId ? "permanente" : "ninguna",
      pedidoRecurrenteId: recurrente.id,
    },
  });

  // Actualizar fechaProximaGeneracion AVANZANDO DESDE LA FECHA ACTUAL, no desde HOY.
  // Antes se hacia proxima = new Date() + frecuenciaDias, lo que rompía la sincronía
  // si el recurrente tenía una fechaProximaGeneracion futura. Ahora se hace igual que el cron:
  // proxima = fechaProximaGeneracion_actual + frecuenciaDias.
  const proxima = new Date(recurrente.fechaProximaGeneracion);
  proxima.setDate(proxima.getDate() + recurrente.frecuenciaDias);
  await db.pedidoRecurrente.update({
    where: { id: recurrente.id },
    data: { fechaProximaGeneracion: proxima },
  });

  return NextResponse.json({ pedido: nuevoPedido, proximaGeneracion: proxima }, { status: 201 });
}
