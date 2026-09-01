import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// POST /api/cliente/pedidos/[id]/cancelar
// Reglas:
//   - Si no fue tomado (en_pool o preferido_notificado) → reembolso 100% (si pagó con saldo)
//   - Si ya fue tomado (asignado o en_camino) → 50% penalización, reembolso 50% (si pagó con saldo)
//   - Si ya fue entregado → no se puede cancelar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const motivo = body.motivo?.trim() || "Cancelado por el cliente";

    const pedido = await db.pedidoApp.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, saldo: true } },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }
    if (pedido.clienteId !== session.clienteId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    if (["entregado", "cancelado", "expirado"].includes(pedido.estado)) {
      return NextResponse.json({ error: `No se puede cancelar un pedido ${pedido.estado}` }, { status: 400 });
    }

    const fueTomado = ["asignado", "en_camino"].includes(pedido.estado);
    const ahora = new Date();

    // Calcular reembolso
    let reembolsoMonto = 0;
    let penalizacion = 0;
    if (fueTomado) {
      // 50% penalización
      penalizacion = Math.round(pedido.monto * 0.50);
      reembolsoMonto = pedido.monto - penalizacion;
    } else {
      // 100% reembolso
      reembolsoMonto = pedido.monto;
    }

    // Actualizar pedido
    await db.pedidoApp.update({
      where: { id },
      data: {
        estado: "cancelado",
        canceladoEn: ahora,
        canceladoPor: "cliente",
        motivoCancelacion: motivo,
        reembolsoMonto: pedido.estadoPago === "confirmado" ? reembolsoMonto : 0,
        penalizacionCancelacion: penalizacion,
      },
    });

    // Si pagó con saldo y tiene reembolso, devolver al saldo
    if (pedido.metodoPago === "saldo" && pedido.estadoPago === "confirmado" && reembolsoMonto > 0) {
      const nuevoSaldo = pedido.cliente.saldo + reembolsoMonto;
      await db.$transaction([
        db.clienteApp.update({
          where: { id: pedido.clienteId },
          data: { saldo: nuevoSaldo },
        }),
        db.movimientoSaldoClienteApp.create({
          data: {
            clienteId: pedido.clienteId,
            tipo: "reembolso",
            monto: reembolsoMonto,
            saldoResultante: nuevoSaldo,
            descripcion: `Reembolso de pedido #${id.slice(-6)}${fueTomado ? ` (50% — penalización ${penalizacion})` : " (cancelado antes de tomarse)"}`,
            pedidoAppId: id,
            confirmado: true,
            confirmadoEn: ahora,
          },
        }),
      ]);
    }

    return NextResponse.json({
      ok: true,
      reembolso: pedido.metodoPago === "saldo" && pedido.estadoPago === "confirmado" ? reembolsoMonto : 0,
      penalizacion: fueTomado ? penalizacion : 0,
      mensaje: fueTomado
        ? `Pedido cancelado. Te reembolsamos ${reembolsoMonto} (se retuvo ${penalizacion} por costos administrativos).`
        : "Pedido cancelado. Reembolso completo aplicado a tu saldo.",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo cancelar el pedido" }, { status: 500 });
  }
}
