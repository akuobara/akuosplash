import { MercadoPagoConfig, Preference } from "mercadopago";

// Configuración de MercadoPago para AkuoSplash
// Env vars:
//   AKUO_MP_ACCESS_TOKEN = access token de tu cuenta empresa
//   AKUO_MP_PUBLIC_KEY = public key (no se usa para backend, solo informativa)
//   AKUO_PRECIO_POR_LITRO = precio por litro en CLP (default 50)
//   AKUO_COMISION_PORCENTAJE = comisión de la app en % (default 0)

function getClient() {
  const accessToken = process.env.AKUO_MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("AKUO_MP_ACCESS_TOKEN no configurado");
  }
  return new MercadoPagoConfig({ accessToken });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.cl";

export function getPrecioPorLitro(): number {
  const v = process.env.AKUO_PRECIO_POR_LITRO;
  return v ? Number(v) : 50;
}

export function getComisionPorcentaje(): number {
  const v = process.env.AKUO_COMISION_PORCENTAJE;
  return v ? Number(v) : 0;
}

// Calcula el monto total que paga el cliente:
// litros × precioPorLitro + comisión% sobre ese subtotal
export function calcularPrecioTotal(litros: number): { subtotal: number; comision: number; total: number } {
  const precio = getPrecioPorLitro();
  const subtotal = Math.round(litros * precio);
  const comisionPct = getComisionPorcentaje();
  const comision = Math.round((subtotal * comisionPct) / 100);
  return { subtotal, comision, total: subtotal + comision };
}

// External reference con prefijo "akuo_pedido_pago:" para distinguirlo del de Aljibe
export async function crearPreferenciaPedidoAkuo(params: {
  clienteId: string;
  clienteNombre: string;
  email: string;
  monto: number;
  pedidoId: string;
  litros: number;
}): Promise<{ preferenceId: string; initPoint: string; sandboxInitPoint: string }> {
  const client = getClient();
  const preference = new Preference(client);

  const result = await preference.create({
    body: {
      items: [
        {
          id: params.pedidoId,
          title: `AkuoSplash — Pedido de agua`,
          description: `Pedido de ${params.litros} litros de agua para ${params.clienteNombre}`,
          quantity: 1,
          unit_price: params.monto,
          currency_id: "CLP",
        },
      ],
      payer: {
        name: params.clienteNombre,
        email: params.email,
      },
      external_reference: `akuo_pedido_pago:${params.clienteId}:${params.pedidoId}`,
      back_urls: {
        success: `${APP_URL}/akuosplash/cliente?status=success`,
        failure: `${APP_URL}/akuosplash/cliente?status=failure`,
        pending: `${APP_URL}/akuosplash/cliente?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${APP_URL}/api/akuosplash/webhooks/mercadopago`,
    },
  });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
    sandboxInitPoint: result.sandbox_init_point!,
  };
}

// Verifica un pago consultando la API de MP
export async function verificarPagoAkuo(paymentId: string): Promise<{
  status: string;
  externalReference: string;
  transactionAmount: number;
} | null> {
  const accessToken = process.env.AKUO_MP_ACCESS_TOKEN;
  if (!accessToken) return null;

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    status: data.status, // approved, pending, rejected
    externalReference: data.external_reference || "",
    transactionAmount: data.transaction_amount || 0,
  };
}
