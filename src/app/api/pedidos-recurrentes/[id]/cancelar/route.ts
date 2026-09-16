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
//
// 1. modo="proximo":
//    - Cancela el próximo Pedido ya generado para la fechaProximaGeneracion
//    - Avanza fechaProximaGeneracion por frecuenciaDias (sigue generando normalmente)
//    - Mantiene activo=true
//
// 2. modo="periodo":
//    - Requiere hastaFecha (fecha límite, no inclusive, hasta la cual pausar)
//    - Cancela todos los Pedidos ya generados con fechaSolicitada entre hoy y hastaFecha
//    - Avanza fechaProximaGeneracion a (hastaFecha + 1 día) o al próximo ciclo
//    - Mantiene activo=true (sigue generando después del periodo)
//
// 3. modo="todos":
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
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const modo = body.modo as "proximo" | "periodo" | "todos";
  const razon = body.razon as string | undefined;

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

  const recurrente = await db.pedidoRecurrente.findUnique({ where: { id } });
  if (!recurrente || recurrente.duenoId !== session.userId) {
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
  // Cancelar el próximo Pedido generado, avanzar fechaProximaGeneracion por frecuenciaDias
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

    // Cancelar el primero (el próximo a entregar)
    if (proximosPedidos.length > 0) {
      const proximo = proximosPedidos[0];
      await db.pedido.update({
        where: { id: proximo.id },
        data: { estado: "cancelado", nota: `Cancelado por recurrencia (próximo pedido)${notasCancelacion}` },
      });
      resultado.pedidosCancelados = 1;
      resultado.detallePedidos.push({
        id: proximo.id,
        fecha: proximo.fechaSolicitada ? String(proximo.fechaSolicitada) : "sin fecha",
        cliente: proximo.clienteNombre,
      });
    }

    // Avanzar fechaProximaGeneracion por frecuenciaDias
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
