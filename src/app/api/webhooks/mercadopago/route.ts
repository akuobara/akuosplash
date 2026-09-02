import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarPago } from "@/lib/mercadopago";

// POST /api/webhooks/mercadopago
// Webhook que recibe notificaciones de MercadoPago (IPN/Webhook)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId = body?.data?.id || body?.id;

    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // Verificar el pago con MercadoPago
    const pago = await verificarPago(String(paymentId));
    if (!pago) {
      return NextResponse.json({ ok: true });
    }

    // Solo procesar si el pago fue aprobado
    if (pago.status !== "approved") {
      return NextResponse.json({ ok: true });
    }

    // Parsear external_reference
    // Formato: "carga_saldo:clienteId:movimientoId" o "suscripcion:duenoId:planId"
    const parts = pago.externalReference.split(":");
    const tipo = parts[0];

    if (tipo === "carga_saldo") {
      const clienteId = parts[1];
      const movimientoId = parts[2];

      // Verificar que el movimiento existe y no está confirmado
      const movimiento = await db.movimientoSaldoClienteApp.findUnique({
        where: { id: movimientoId },
        include: { cliente: { select: { id: true, saldo: true } } },
      });

      if (!movimiento || movimiento.confirmado) {
        return NextResponse.json({ ok: true });
      }

      // Sumar al saldo del cliente
      const nuevoSaldo = movimiento.cliente.saldo + movimiento.monto;

      await db.$transaction([
        db.movimientoSaldoClienteApp.update({
          where: { id: movimientoId },
          data: {
            confirmado: true,
            confirmadoEn: new Date(),
            saldoResultante: nuevoSaldo,
            descripcion: "Carga confirmada por MercadoPago",
          },
        }),
        db.clienteApp.update({
          where: { id: clienteId },
          data: { saldo: nuevoSaldo },
        }),
      ]);
    } else if (tipo === "suscripcion") {
      const duenoId = parts[1];
      const planId = parts[2];

      // Actualizar el plan del admin
      await db.configuracion.update({
        where: { duenoId },
        data: { planId },
      });

      // TODO: registrar el pago de suscripción para historial
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[MercadoPago webhook] error:", e);
    return NextResponse.json({ ok: true });
  }
}
