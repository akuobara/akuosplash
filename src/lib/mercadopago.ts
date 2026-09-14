import { MercadoPagoConfig, Preference } from "mercadopago";

// Configurar cliente de MercadoPago
// Las credenciales deben estar en variables de entorno:
// MERCADOPAGO_ACCESS_TOKEN = access token de tu cuenta
// MERCADOPAGO_PUBLIC_KEY = public key (para frontend)

function getClient() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");
  }
  return new MercadoPagoConfig({ accessToken });
}

// Crear preferencia de pago para carga de saldo del cliente
export async function crearPreferenciaCargaSaldo(params: {
  clienteId: string;
  clienteNombre: string;
  email: string;
  monto: number;
  movimientoId: string;
}): Promise<{ preferenceId: string; initPoint: string; sandboxInitPoint: string }> {
  const client = getClient();
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: params.movimientoId,
          title: `Carga de saldo - Aljibe App`,
          description: `Carga de saldo para ${params.clienteNombre}`,
          quantity: 1,
          unit_price: params.monto,
          currency_id: "CLP",
        },
      ],
      payer: {
        name: params.clienteNombre,
        email: params.email,
      },
      external_reference: `carga_saldo:${params.clienteId}:${params.movimientoId}`,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/cliente/saldo?status=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/cliente/saldo?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/cliente/saldo?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/api/webhooks/mercadopago`,
    },
  });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
    sandboxInitPoint: result.sandbox_init_point!,
  };
}

// Crear preferencia de pago para suscripción de plan del admin
export async function crearPreferenciaSuscripcion(params: {
  duenoId: string;
  duenoNombre: string;
  email: string;
  planId: string;
  planNombre: string;
  monto: number;
}): Promise<{ preferenceId: string; initPoint: string; sandboxInitPoint: string }> {
  const client = getClient();
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: `plan_${params.planId}`,
          title: `Suscripción ${params.planNombre} - Aljibe App`,
          description: `Pago mensual del plan ${params.planNombre}`,
          quantity: 1,
          unit_price: params.monto,
          currency_id: "CLP",
        },
      ],
      payer: {
        name: params.duenoNombre,
        email: params.email,
      },
      external_reference: `suscripcion:${params.duenoId}:${params.planId}`,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/suscripcion?status=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/suscripcion?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/suscripcion?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/api/webhooks/mercadopago`,
    },
  });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
    sandboxInitPoint: result.sandbox_init_point!,
  };
}

// Crear preferencia de pago para pedido de agua de la app cliente
// External reference: "pedido_pago:clienteId:pedidoId"
export async function crearPreferenciaPedidoPago(params: {
  clienteId: string;
  clienteNombre: string;
  email: string;
  monto: number;
  pedidoId: string;
  litros: number;
  descripcion?: string;
}): Promise<{ preferenceId: string; initPoint: string; sandboxInitPoint: string }> {
  const client = getClient();
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: params.pedidoId,
          title: `Pedido de agua - Aljibe App`,
          description: params.descripcion || `Pedido #${params.pedidoId.slice(-6)} — ${params.litros} L para ${params.clienteNombre}`,
          quantity: 1,
          unit_price: params.monto,
          currency_id: "CLP",
        },
      ],
      payer: {
        name: params.clienteNombre,
        email: params.email,
      },
      external_reference: `pedido_pago:${params.clienteId}:${params.pedidoId}`,
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/cliente?status=success`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/cliente?status=failure`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/cliente?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://e-five-82.vercel.app"}/api/webhooks/mercadopago`,
    },
  });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
    sandboxInitPoint: result.sandbox_init_point!,
  };
}

// Verificar pago desde webhook (IPN)
export async function verificarPago(paymentId: string): Promise<{
  status: string;
  externalReference: string;
  transactionAmount: number;
} | null> {
  const client = getClient();

  // Usar fetch directo al API de MercadoPago
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  return {
    status: data.status, // approved, pending, rejected
    externalReference: data.external_reference || "",
    transactionAmount: data.transaction_amount || 0,
  };
}
