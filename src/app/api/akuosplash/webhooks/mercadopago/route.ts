import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { verificarPagoAkuo, verificarOrdenAkuo } from "@/lib/akuosplash-mercadopago";
import { akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/webhooks/mercadopago
// Webhook que recibe notificaciones de MercadoPago (IPN/Webhook)
// External reference formato: "akuo_pedido_pago:clienteId:pedidoId"
// Soporta tanto eventos legacy de Payments como la nueva API de Orders
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Tipo de recurso: "payment" (legacy) o "merchant_order" / "order" (nueva API)
    const tipo = body?.type || body?.topic || body?.resource;
    const resourceId = body?.data?.id || body?.id || body?.resource_id;

    // Para queries de MercadoPago (GET ?type=payment&data.id=123)
    const url = new URL(req.url);
    const queryType = url.searchParams.get("type");
    const queryDataId = url.searchParams.get("data.id");

    const paymentId = resourceId || queryDataId;
    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    // Intentar primero como pago (legacy API de Payments — sigue disponible para queries)
    if (queryType === "payment" || tipo === "payment") {
      const pago = await verificarPagoAkuo(String(paymentId));
      if (pago && pago.status === "approved") {
        await procesarPagoConfirmado(paymentId, pago.externalReference, pago.transactionAmount);
      }
      return NextResponse.json({ ok: true });
    }

    // Si es una orden (nueva API de Orders)
    if (queryType === "merchant_order" || tipo === "merchant_order" || tipo === "order") {
      const orden = await verificarOrdenAkuo(String(paymentId));
      if (orden && (orden.status === "paid" || orden.status === "closed" || orden.status === "approved")) {
        await procesarPagoConfirmado(paymentId, orden.externalReference, orden.totalAmount);
      }
      return NextResponse.json({ ok: true });
    }

    // Default: intentar como pago
    const pago = await verificarPagoAkuo(String(paymentId));
    if (pago && pago.status === "approved") {
      await procesarPagoConfirmado(paymentId, pago.externalReference, pago.transactionAmount);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[AkuoSplash MP webhook] error:", e);
    return NextResponse.json({ ok: true });
  }
}

// Procesa un pago confirmado: marca el pedido como pagado y notifica al cliente
async function procesarPagoConfirmado(paymentId: string | number, externalReference: string, transactionAmount: number) {
  // Parsear external_reference: "akuo_pedido_pago:clienteId:pedidoId"
  const parts = String(externalReference).split(":");
  if (parts[0] !== "akuo_pedido_pago") return;
  const clienteId = parts[1];
  const pedidoId = parts[2];

  const pedido = await akuosplashDb.akuoPedidoCliente.findUnique({ where: { id: pedidoId } });
  if (!pedido) return;
  if (pedido.estadoPago === "pagado") return; // Idempotencia

  await akuosplashDb.akuoPedidoCliente.update({
    where: { id: pedidoId },
    data: {
      estadoPago: "pagado",
      mpPaymentId: String(paymentId),
      precioTotal: transactionAmount,
    },
  });

  await akuoNotificar(
    clienteId,
    "pago_confirmado",
    "Pago confirmado",
    `Tu pago de $${transactionAmount.toLocaleString("es-CL")} fue confirmado. El pedido está listo para que un repartidor lo tome.`,
    "/akuosplash/cliente",
  );
}
