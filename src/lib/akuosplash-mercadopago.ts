import { akuosplashDb } from "./akuosplash-db";

// Configuración de MercadoPago para AkuoSplash
// Env vars:
//   AKUO_MP_ACCESS_TOKEN = access token de la plataforma
//   AKUO_MP_USER_ID = MP user ID de la plataforma (para splitter)
//   AKUO_MP_CLIENT_ID = para OAuth de repartidores
//   AKUO_MP_CLIENT_SECRET = para OAuth de repartidores
//   AKUO_MP_SANDBOX = "true" para usar sandbox (testing)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.cl";

// Calcula distancia Haversine entre dos puntos en km
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Verifica si un punto [lng, lat] está dentro de un polígono GeoJSON (ray casting)
function puntoEnPoligono(lat: number, lng: number, geoJsonStr: string): boolean {
  try {
    const geo = JSON.parse(geoJsonStr);
    if (!geo.coordinates || !Array.isArray(geo.coordinates)) return false;
    const polygon = geo.coordinates[0];
    if (!polygon || polygon.length < 3) return false;
    let dentro = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-10) + xi);
      if (intersect) dentro = !dentro;
    }
    return dentro;
  } catch { return false; }
}

// Detecta la zona aplicable a una ubicación (lat/lng)
export async function detectarZona(lat?: number, lng?: number): Promise<any | null> {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return null;
  const zonas = await akuosplashDb.akuoZona.findMany({ where: { activa: true } });
  if (zonas.length === 0) return null;
  for (const z of zonas) {
    if (z.zonaGeoJson && z.zonaGeoJson !== '{"type":"Polygon","coordinates":[]}' && puntoEnPoligono(lat, lng, z.zonaGeoJson)) {
      return z;
    }
  }
  for (const z of zonas) {
    if (z.centroLat !== null && z.centroLng !== null && z.radioKm !== null) {
      const dist = distanciaKm(lat, lng, z.centroLat, z.centroLng);
      if (dist <= z.radioKm) return z;
    }
  }
  return null;
}

export async function getComisionPorcentaje(): Promise<number> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  return config?.comisionPorcentaje ?? 0;
}

// Calcula el monto total que paga el cliente según su zona asignada
export async function calcularPrecioTotal(litros: number, zonaId?: string | null): Promise<{ subtotal: number; comision: number; total: number; precioPorLitro: number; comisionPct: number; zonaNombre: string | null } | null> {
  if (!zonaId) return null;
  const zona = await akuosplashDb.akuoZona.findUnique({ where: { id: zonaId } });
  if (!zona) return null;
  const subtotal = Math.round(litros * zona.precioPorLitro);
  const comisionPct = await getComisionPorcentaje();
  const comision = Math.round((subtotal * comisionPct) / 100);
  return { subtotal, comision, total: subtotal + comision, precioPorLitro: zona.precioPorLitro, comisionPct, zonaNombre: zona.nombre };
}

interface OrdenResult {
  orderId: string;
  initPoint: string;
  splitPayment: boolean;
}

// Crea una orden de pago usando la nueva API de Orders de MercadoPago
// Si el repartidor tiene su cuenta MP conectada (OAuth), se hace split payment
// automático: el repartidor recibe (total - comisión), la plataforma retiene la comisión
// Doc: https://www.mercadopago.cl/developers/es/docs/checkout-api/integration-configuration/integration-with-api-orders
export async function crearOrdenAkuo(params: {
  clienteId: string;
  clienteNombre: string;
  email: string;
  monto: number;
  pedidoId: string;
  litros: number;
  comisionApp: number;
  repartidorMpAccessToken?: string | null;
  repartidorMpUserId?: string | null;
}): Promise<OrdenResult> {
  // Si el repartidor tiene MP conectado, usar su access_token (split payment automático)
  const accessToken = params.repartidorMpAccessToken || process.env.AKUO_MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("AKUO_MP_ACCESS_TOKEN no configurado");
  }

  const idempotencyKey = `akuo-${params.pedidoId}-${Date.now()}`;
  const isSandbox = process.env.AKUO_MP_SANDBOX === "true";

  const body: any = {
    type: "online",
    total_amount: params.monto,
    external_reference: `akuo_pedido_pago:${params.clienteId}:${params.pedidoId}`,
    items: [
      {
        id: params.pedidoId,
        title: "AkuoSplash — Pedido de agua",
        description: `Pedido de ${params.litros} litros de agua para ${params.clienteNombre}`,
        quantity: 1,
        unit_price: params.monto,
        category_id: "services",
      },
    ],
    transactions: {
      payments: [
        {
          amount: params.monto,
          payment_method: { type: "checkout_pro" },
        },
      ],
    },
    payer: {
      name: params.clienteNombre,
      email: params.email,
    },
    notification_url: `${APP_URL}/api/akuosplash/webhooks/mercadopago`,
  };

  // Si el repartidor tiene MP conectado, agregar splitter para dividir automáticamente
  let splitPayment = false;
  if (params.repartidorMpAccessToken && params.repartidorMpUserId) {
    const plataformaUserId = process.env.AKUO_MP_USER_ID;
    if (!plataformaUserId) {
      throw new Error("AKUO_MP_USER_ID no configurado — es el MP user ID de la plataforma, necesario para el split");
    }
    const montoRepartidor = params.monto - params.comisionApp;
    body.splitter = {
      items: [
        {
          item_id: params.pedidoId,
          splitter_distributions: [
            {
              collector: { id: Number(params.repartidorMpUserId) },
              amount: montoRepartidor,
            },
            {
              collector: { id: Number(plataformaUserId) },
              amount: params.comisionApp,
            },
          ],
        },
      ],
    };
    splitPayment = true;
  }

  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
      ...(isSandbox ? { "X-Sandbox": "true" } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `MP Orders API error ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      errMsg = `${errMsg}: ${errJson.message || errJson.error || errText.substring(0, 300)}`;
    } catch {
      errMsg = `${errMsg}: ${errText.substring(0, 300)}`;
    }
    throw new Error(errMsg);
  }

  const data = await res.json();

  // Extraer URL de checkout — la estructura puede variar según la versión de la API
  let initPoint = "";
  if (data.checkout_url) {
    initPoint = data.checkout_url;
  } else if (data.url) {
    initPoint = data.url;
  } else if (data.transactions?.payments?.[0]?.payment_method?.checkout_url) {
    initPoint = data.transactions.payments[0].payment_method.checkout_url;
  } else if (data.transactions?.payments?.[0]?.url) {
    initPoint = data.transactions.payments[0].url;
  } else if (data.payment_methods?.[0]?.checkout_url) {
    initPoint = data.payment_methods[0].checkout_url;
  } else {
    console.error("MP Orders API response:", JSON.stringify(data, null, 2));
    throw new Error("No se pudo extraer la URL de checkout de la respuesta de MP");
  }

  return {
    orderId: String(data.id || ""),
    initPoint,
    splitPayment,
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

// Consulta el estado de una orden por ID
export async function verificarOrdenAkuo(orderId: string): Promise<{
  status: string;
  externalReference: string;
  totalAmount: number;
} | null> {
  const accessToken = process.env.AKUO_MP_ACCESS_TOKEN;
  if (!accessToken) return null;

  const res = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    status: data.status,
    externalReference: data.external_reference || "",
    totalAmount: data.total_amount || 0,
  };
}
