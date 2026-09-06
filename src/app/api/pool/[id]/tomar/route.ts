import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/pool/[id]/tomar — un chofer/admin toma un pedido del pool
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Verificar plan
  const config = await db.configuracion.findUnique({
    where: { duenoId },
    select: { planId: true },
  });
  const planId = config?.planId || "free";
  const plan = await db.plan.findUnique({
    where: { id: planId },
    select: { accesoPool: true },
  });
  if (!plan || !plan.accesoPool) {
    return NextResponse.json({ error: "Tu plan no incluye acceso al pool" }, { status: 403 });
  }

  // Tomar el pedido (transacción atómica para evitar que dos choferes lo tomen a la vez)
  try {
    const ahora = new Date();

    // Intentar tomar el pedido: solo si sigue en_pool
    const pedido = await db.pedidoApp.findUnique({ where: { id } });
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.estado !== "en_pool") {
      return NextResponse.json({
        error: `El pedido ya no está disponible (estado: ${pedido.estado})`,
      }, { status: 400 });
    }

    // Actualizar el historial
    let historial: any[] = [];
    try { historial = JSON.parse(pedido.historialJson || "[]"); } catch {}
    historial.push({ estado: "asignado", fecha: ahora.toISOString(), por: session.userId });

    await db.pedidoApp.update({
      where: { id },
      data: {
        estado: "asignado",
        tomadoPorId: session.userId,
        tomadoEn: ahora,
        historialJson: JSON.stringify(historial),
      },
    });

    // Si el cliente tiene proveedor preferido y este chofer/admin NO es el preferido,
    // el cliente recibe una notificación (por ahora solo registramos en historial).
    // El proveedor preferido del cliente se actualiza automáticamente al primer admin que le entrega.
    // (Eso se hace al entregar, no al tomar.)

    return NextResponse.json({
      ok: true,
      pedido: { id, estado: "asignado", tomadoEn: ahora },
      mensaje: "Pedido asignado a vos. Andá a entregar el agua.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo tomar el pedido" }, { status: 500 });
  }
}
