import { MercadoPagoConfig, Preference } from "mercadopago";
import { akuosplashDb } from "./akuosplash-db";

// Configuración de MercadoPago para AkuoSplash
// Env vars:
//   AKUO_MP_ACCESS_TOKEN = access token de tu cuenta empresa

function getClient() {
  const accessToken = process.env.AKUO_MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("AKUO_MP_ACCESS_TOKEN no configurado");
  }
  return new MercadoPagoConfig({ accessToken });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.cl";

// Devuelve el precio por litro para una comuna dada
// Si no hay precio específico para la comuna, usa el default de AkuoConfig (default $50)
export async function getPrecioPorLitro(comuna?: string): Promise<number> {
  // Buscar precio específico para la comuna
  if (comuna && comuna.trim()) {
    const zona = await akuosplashDb.akuoZonaPrecio.findFirst({
      where: { comuna: comuna.trim(), activo: true },
    });
    if (zona) return zona.precioPorLitro;
  }
  // Default del AkuoConfig
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  return config?.precioPorLitroAguaDefault ?? 50;
}

// Devuelve la comisión de la app en % (configurada por superadmin en AkuoConfig)
export async function getComisionPorcentaje(): Promise<number> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  return config?.comisionPorcentaje ?? 0;
}

// Calcula el monto total que paga el cliente:
// litros × precioPorLitro + comisión% sobre ese subtotal
export async function calcularPrecioTotal(litros: number, comuna?: string): Promise<{ subtotal: number; comision: number; total: number; precioPorLitro: number; comisionPct: number }> {
  const precio = await getPrecioPorLitro(comuna);
  const subtotal = Math.round(litros * precio);
  const comisionPct = await getComisionPorcentaje();
  const comision = Math.round((subtotal * comisionPct) / 100);
  return { subtotal, comision, total: subtotal + comision, precioPorLitro: precio, comisionPct };
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
    status: data.status,
    externalReference: data.external_reference || "",
    transactionAmount: data.transaction_amount || 0,
  };
}
