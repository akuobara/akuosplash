import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { verificarPagoAkuo } from "@/lib/akuosplash-mercadopago";
import { akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/webhooks/mercadopago
// Webhook que recibe notificaciones de MercadoPago (IPN/Webhook)
// External reference formato: "akuo_pedido_pago:clienteId:pedidoId"
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const paymentId = body?.data?.id || body?.id;

    // Soporte para query params de IPN (GET ?type=payment&data.id=123)
    const url = new URL(req.url);
    const queryDataId = url.searchParams.get("data.id");
    const finalPaymentId = paymentId || queryDataId;

    if (!finalPaymentId) {
      return NextResponse.json({ ok: true });
    }

    const pago = await verificarPagoAkuo(String(finalPaymentId));
    if (!pago) return NextResponse.json({ ok: true });

    if (pago.status !== "approved") return NextResponse.json({ ok: true });

    // Parsear external_reference: "akuo_pedido_pago:clienteId:pedidoId"
    const parts = pago.externalReference.split(":");
    if (parts[0] !== "akuo_pedido_pago") return NextResponse.json({ ok: true });
    const clienteId = parts[1];
    const pedidoId = parts[2];

    const pedido = await akuosplashDb.akuoPedidoCliente.findUnique({ where: { id: pedidoId } });
    if (!pedido) return NextResponse.json({ ok: true });
    if (pedido.estadoPago === "pagado") return NextResponse.json({ ok: true });

    await akuosplashDb.akuoPedidoCliente.update({
      where: { id: pedidoId },
      data: {
        estadoPago: "pagado",
        mpPaymentId: String(finalPaymentId),
        precioTotal: pago.transactionAmount,
      },
    });

    await akuoNotificar(
      clienteId,
      "pago_confirmado",
      "Pago confirmado",
      `Tu pago de $${pago.transactionAmount.toLocaleString("es-CL")} fue confirmado. El pedido está listo para que un repartidor lo tome.`,
      "/akuosplash/cliente",
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[AkuoSplash MP webhook] error:", e);
    return NextResponse.json({ ok: true });
  }
}
