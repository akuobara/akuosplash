import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/pedidos/[id]/soltar
// El chofer suelta un pedido individual.
// - Si el chofer es el chofer preferido del cliente, puede elegir un reemplazo (body.reemplazoChoferId).
// - Si el chofer NO es el preferido (pedido asignado por el dueño), NO puede elegir reemplazo.
//   El pedido va al pool (asignacionTipo = "publicado") para que el dueño u otro chofer lo tome.
// - El dueño siempre puede elegir reemplazo.
//
// Body opcional: { reemplazoChoferId?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reemplazoChoferId = body.reemplazoChoferId || null;

  const pedido = await db.pedido.findUnique({ where: { id } });
  if (!pedido || pedido.duenoId !== duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (pedido.estado === "entregado") {
    return NextResponse.json({ error: "No se puede soltar un pedido ya entregado" }, { status: 400 });
  }

  // Verificar que el chofer tiene relación con el pedido
  const esSuPedido =
    pedido.choferAsignadoId === session.userId ||
    pedido.tomadoPorChoferId === session.userId ||
    pedido.prioridadChoferId === session.userId ||
    pedido.choferId === session.userId;

  if (session.role === "chofer" && !esSuPedido) {
    return NextResponse.json({ error: "No tienes relación con este pedido" }, { status: 403 });
  }

  // Determinar si el chofer es el preferido del cliente (puede elegir reemplazo)
  let esChoferPreferido = false;
  if (pedido.clienteId) {
    const cliente = await db.cliente.findUnique({
      where: { id: pedido.clienteId },
      select: { choferPreferidoId: true },
    });
    esChoferPreferido = cliente?.choferPreferidoId === session.userId;
  }

  // Chofer que NO es preferido NO puede elegir reemplazo
  if (session.role === "chofer" && reemplazoChoferId && !esChoferPreferido) {
    return NextResponse.json(
      { error: "No puedes elegir un reemplazo porque no eres el chofer preferido de este cliente. El pedido irá al pool para que el dueño lo reasigne." },
      { status: 403 }
    );
  }

  // Validar reemplazo si se proporciona
  if (reemplazoChoferId) {
    const reemplazo = await db.usuario.findUnique({
      where: { id: reemplazoChoferId },
      select: { id: true, role: true, activo: true },
    });
    if (!reemplazo || reemplazo.role !== "chofer" || !reemplazo.activo) {
      return NextResponse.json({ error: "El reemplazo debe ser un chofer activo" }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};

  if (reemplazoChoferId) {
    // CON reemplazo: reasignar al nuevo chofer
    if (pedido.prioridadChoferId === session.userId || esChoferPreferido) {
      data.prioridadChoferId = reemplazoChoferId;
      data.prioridadTipo = "permanente";
    }
    if (pedido.tomadoPorChoferId === session.userId) {
      data.tomadoPorChoferId = reemplazoChoferId;
      data.choferId = reemplazoChoferId;
    }
    if (pedido.choferAsignadoId === session.userId) {
      data.choferAsignadoId = reemplazoChoferId;
    }
  } else {
    // SIN reemplazo: limpiar referencias y publicar al pool
    if (pedido.prioridadChoferId === session.userId) {
      data.prioridadChoferId = null;
      data.prioridadTipo = "ninguna";
    }
    if (pedido.tomadoPorChoferId === session.userId) {
      data.tomadoPorChoferId = null;
    }
    if (pedido.choferAsignadoId === session.userId) {
      data.choferAsignadoId = null;
    }
    // Si estaba en_ruta, volver a pendiente
    if (pedido.estado === "en_ruta") {
      data.estado = "pendiente";
    }
    // Publicar al pool si era asignación manual
    if (pedido.asignacionTipo === "manual") {
      data.asignacionTipo = "publicado";
      data.publicadoEn = new Date();
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, message: "No había nada que soltar" });
  }

  await db.pedido.update({ where: { id }, data });

  return NextResponse.json({
    ok: true,
    reemplazo: !!reemplazoChoferId,
    publicado: !reemplazoChoferId,
  });
}
