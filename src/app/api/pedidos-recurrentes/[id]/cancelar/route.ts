import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/pedidos-recurrentes/[id]/cancelar
//
// Permite cancelar pedidos recurrentes de 3 maneras distintas:
//
// Body:
//   modo: "proximo" | "periodo" | "todos"
//   hastaFecha?: string ISO date (solo para modo "periodo") — fecha hasta la cual pausar
//   razon?: string — nota opcional con la razón de la cancelación
//   pedidoId?: string — ID del pedido específico a cancelar (modo "proximo")
//                       Si se pasa, se cancela ESE pedido (no el más temprano).
//                       Es para soportar el caso donde el usuario hace click en "cancelar"
//                       sobre un pedido específico (ej: el de mañana) y no el más próximo.
//
// 1. modo="proximo":
//    - Si viene pedidoId: cancela ESE pedido específico
//    - Si no: cancela el próximo Pedido (el de fecha más cercana)
//    - Avanza fechaProximaGeneracion por frecuenciaDias (sigue generando normalmente)
//    - Mantiene activo=true
//
// 2. modo="periodo": (sin cambios)
//    - Requiere hastaFecha (fecha límite, no inclusive, hasta la cual pausar)
//    - Cancela todos los Pedidos ya generados con fechaSolicitada entre hoy y hastaFecha
//    - Avanza fechaProximaGeneracion a (hastaFecha + 1 día) o al próximo ciclo
//    - Mantiene activo=true (sigue generando después del periodo)
//
// 3. modo="todos": (sin cambios)
//    - Cancela el próximo Pedido generado
//    - Setea activo=false (no genera más pedidos en el futuro)
//    - NO borra el recurrente (mantiene historial)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const modo = body.modo as "proximo" | "periodo" | "todos";
  const razon = body.razon as string | undefined;
  const pedidoIdEspecifico = body.pedidoId as string | undefined;

  if (!modo || !["proximo", "periodo", "todos"].includes(modo)) {
    return NextResponse.json(
      { error: "Modo inválido. Debe ser 'proximo', 'periodo' o 'todos'." },
      { status: 400 }
    );
  }

  if (modo === "periodo" && !body.hastaFecha) {
    return NextResponse.json(
      { error: "Para modo='periodo' se requiere hastaFecha (ISO date)" },
      { status: 400 }
    );
  }

  // Cargar el recurrente (incluyendo choferAsignadoId para verificación de chofer)
  const recurrente = await db.pedidoRecurrente.findUnique({ where: { id } });
  if (!recurrente) {
    return NextResponse.json({ error: "Recurrencia no encontrada" }, { status: 404 });
  }

  // Autorización:
  // - Dueño: debe ser el dueño del recurrente (recurrente.duenoId === session.userId)
  // - Chofer: puede cancelar cualquier recurrente del dueno al que pertenece (session.duenoId).
  //   Esto es porque el chofer es el que está en ruta y necesita gestionar los pedidos
  //   que vienen de recurrentes (ej: cliente que ya recibió agua hoy → cancelar el de mañana).
  //   Restringir solo a "asignados a ti" era muy limitante cuando el recurrente no tiene
  //   choferAsignadoId seteado.
  const duenoIdSesion = session.role === "dueno" ? session.userId : session.duenoId;
  if (!duenoIdSesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (recurrente.duenoId !== duenoIdSesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!recurrente.activo && modo !== "todos") {
    return NextResponse.json(
      { error: "La recurrencia ya está inactiva. No se puede cancelar pedidos futuros." },
      { status: 400 }
    );
  }

  const ahora = new Date();
  const frecuencia = recurrente.frecuenciaDias || 7;
  const notasCancelacion = razon ? ` — ${razon}` : "";

  // Resultado a devolver
  const resultado: {
    modo: string;
    pedidosCancelados: number;
    fechaProximaGeneracionAnterior: string;
    fechaProximaGeneracionNueva: string | null;
    recurrenteActivo: boolean;
    detallePedidos: Array<{ id: string; fecha: string; cliente: string }>;
  } = {
    modo,
    pedidosCancelados: 0,
    fechaProximaGeneracionAnterior: recurrente.fechaProximaGeneracion.toISOString(),
    fechaProximaGeneracionNueva: null,
    recurrenteActivo: recurrente.activo,
    detallePedidos: [],
  };

  // === MODO "proximo" ===
  // Cancelar UN pedido: el específico (si se pasó pedidoId) o el más próximo (el más temprano)
  if (modo === "proximo") {
    // Buscar todos los Pedidos pendientes/programados que vienen de esta recurrencia
    // y que aún no fueron entregados ni cancelados
    const proximosPedidos = await db.pedido.findMany({
      where: {
        pedidoRecurrenteId: id,
        estado: { in: ["pendiente", "programado"] },
      },
      orderBy: { fechaSolicitada: "asc" },
      select: { id: true, fechaSolicitada: true, clienteNombre: true },
    });

    // Determinar qué pedido cancelar:
    // - Si se pasó pedidoId (click en pedido específico): buscar ESE pedido
    // - Si no: el primero (más próximo a entregar)
    let pedidoACancelar: { id: string; clienteNombre: string; fechaSolicitada: Date | null } | null = null;
    if (pedidoIdEspecifico) {
      pedidoACancelar = proximosPedidos.find(p => p.id === pedidoIdEspecifico) || null;
      if (!pedidoACancelar) {
        // El pedido específico no está en la lista — quizás ya fue entregado/cancelado
        // Hacer una query directa para confirmar
        const directo = await db.pedido.findUnique({
          where: { id: pedidoIdEspecifico },
          select: { id: true, fechaSolicitada: true, clienteNombre: true, estado: true, pedidoRecurrenteId: true },
        });
        if (directo && directo.pedidoRecurrenteId === id) {
          if (directo.estado === "cancelado") {
            return NextResponse.json({ error: "El pedido ya está cancelado" }, { status: 400 });
          }
          if (directo.estado === "entregado") {
            return NextResponse.json({ error: "No se puede cancelar un pedido ya entregado" }, { status: 400 });
          }
          pedidoACancelar = { id: directo.id, fechaSolicitada: directo.fechaSolicitada, clienteNombre: directo.clienteNombre };
        } else {
          return NextResponse.json({ error: "Pedido específico no encontrado o no pertenece a esta recurrencia" }, { status: 404 });
        }
      }
    } else {
      pedidoACancelar = proximosPedidos[0] || null;
    }

    if (pedidoACancelar) {
      await db.pedido.update({
        where: { id: pedidoACancelar.id },
        data: { estado: "cancelado", nota: `Cancelado por recurrencia (próximo pedido)${notasCancelacion}` },
      });
      resultado.pedidosCancelados = 1;
      resultado.detallePedidos.push({
        id: pedidoACancelar.id,
        fecha: pedidoACancelar.fechaSolicitada ? String(pedidoACancelar.fechaSolicitada) : "sin fecha",
        cliente: pedidoACancelar.clienteNombre,
      });
    }

    // Avanzar fechaProximaGeneracion por frecuenciaDias
    // (esto es para que el cron genere el próximo pedido correctamente)
    const nuevaFecha = new Date(recurrente.fechaProximaGeneracion);
    nuevaFecha.setDate(nuevaFecha.getDate() + frecuencia);
    await db.pedidoRecurrente.update({
      where: { id },
      data: { fechaProximaGeneracion: nuevaFecha },
    });
    resultado.fechaProximaGeneracionNueva = nuevaFecha.toISOString();
  }

  // === MODO "periodo" ===
  // Cancelar todos los Pedidos generados entre hoy y hastaFecha (inclusive)
  // Avanzar fechaProximaGeneracion a (hastaFecha + 1 día o próximo ciclo)
  if (modo === "periodo") {
    const hastaFecha = new Date(body.hastaFecha as string);
    hastaFecha.setHours(23, 59, 59, 999);

    if (hastaFecha.getTime() < ahora.getTime()) {
      return NextResponse.json(
        { error: "hastaFecha no puede ser en el pasado" },
        { status: 400 }
      );
    }

    // Buscar todos los Pedidos pendientes/programados en el rango
    const pedidosEnRango = await db.pedido.findMany({
      where: {
        pedidoRecurrenteId: id,
        estado: { in: ["pendiente", "programado"] },
        fechaSolicitada: { gte: ahora, lte: hastaFecha },
      },
      orderBy: { fechaSolicitada: "asc" },
      select: { id: true, fechaSolicitada: true, clienteNombre: true },
    });

    // Cancelar todos
    for (const p of pedidosEnRango) {
      await db.pedido.update({
        where: { id: p.id },
        data: {
          estado: "cancelado",
          nota: `Cancelado por recurrencia (pausa hasta ${hastaFecha.toLocaleDateString("es-CL")})${notasCancelacion}`,
        },
      });
      resultado.detallePedidos.push({
        id: p.id,
        fecha: p.fechaSolicitada ? String(p.fechaSolicitada) : "sin fecha",
        cliente: p.clienteNombre,
      });
    }
    resultado.pedidosCancelados = pedidosEnRango.length;

    // Avanzar fechaProximaGeneracion al primer ciclo después de hastaFecha
    // Calcular próxima fecha: empezar desde hastaFecha + 1 día y avanzar por frecuenciaDias
    // hasta que sea >= hastaFecha. Como ya estamos en el próximo ciclo, usar hastaFecha + frecuenciaDias.
    const nuevaFecha = new Date(hastaFecha);
    nuevaFecha.setDate(nuevaFecha.getDate() + 1);
    // Si nuevaFecha queda antes que ahora, avanzar por frecuenciaDias hasta pasar el presente
    while (nuevaFecha.getTime() < ahora.getTime()) {
      nuevaFecha.setDate(nuevaFecha.getDate() + frecuencia);
    }
    await db.pedidoRecurrente.update({
      where: { id },
      data: { fechaProximaGeneracion: nuevaFecha },
    });
    resultado.fechaProximaGeneracionNueva = nuevaFecha.toISOString();
  }

  // === MODO "todos" ===
  // Cancelar el próximo Pedido generado + desactivar la recurrencia
  if (modo === "todos") {
    const proximosPedidos = await db.pedido.findMany({
      where: {
        pedidoRecurrenteId: id,
        estado: { in: ["pendiente", "programado"] },
      },
      orderBy: { fechaSolicitada: "asc" },
      select: { id: true, fechaSolicitada: true, clienteNombre: true },
    });

    // Cancelar todos los pendientes/programados
    for (const p of proximosPedidos) {
      await db.pedido.update({
        where: { id: p.id },
        data: {
          estado: "cancelado",
          nota: `Cancelado por desactivación de recurrencia${notasCancelacion}`,
        },
      });
      resultado.detallePedidos.push({
        id: p.id,
        fecha: p.fechaSolicitada ? String(p.fechaSolicitada) : "sin fecha",
        cliente: p.clienteNombre,
      });
    }
    resultado.pedidosCancelados = proximosPedidos.length;

    // Desactivar la recurrencia
    await db.pedidoRecurrente.update({
      where: { id },
      data: { activo: false },
    });
    resultado.recurrenteActivo = false;
    resultado.fechaProximaGeneracionNueva = null;
  }

  const mensajes: Record<string, string> = {
    proximo: `Próximo pedido cancelado. Se seguirán agendando pedidos cada ${frecuencia} días a partir del ${resultado.fechaProximaGeneracionNueva ? new Date(resultado.fechaProximaGeneracionNueva).toLocaleDateString("es-CL") : "?"}.`,
    periodo: `Se pausaron ${resultado.pedidosCancelados} pedido(s). Se reanudará el ${resultado.fechaProximaGeneracionNueva ? new Date(resultado.fechaProximaGeneracionNueva).toLocaleDateString("es-CL") : "?"}.`,
    todos: `Recurrencia desactivada. ${resultado.pedidosCancelados} pedido(s) cancelado(s).`,
  };

  return NextResponse.json({
    ok: true,
    ...resultado,
    message: mensajes[modo],
  });
}
