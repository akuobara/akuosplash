import { MercadoPagoConfig, Preference } from "mercadopago";
import { akuosplashDb } from "./akuosplash-db";
import { getMpSplitCreds, MpSplitMode } from "./akuosplash-plans";

// Configuración de MercadoPago para AkuoSplash
// Usa Checkout Pro via Preferences (NO deprecado — solo /v1/payments directo lo está)
// + Marketplace flow con `marketplace_fee` para split automático
//
// Env vars:
//   AKUO_MP_ACCESS_TOKEN = access token de la plataforma
//   AKUO_MP_CLIENT_ID = para OAuth de repartidores
//   AKUO_MP_CLIENT_SECRET = para OAuth de repartidores

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
  // DEFENSIVE: usar raw SQL porque AkuoConfig.findFirst() puede fallar si hay columnas nuevas no migradas
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(`SELECT comisionPorcentaje FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
    if (Array.isArray(result) && result.length > 0) {
      return result[0]?.comisionPorcentaje ?? 0;
    }
    return 0;
  } catch {
    return 0;
  }
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

interface PreferenciaResult {
  preferenceId: string;
  initPoint: string;
  splitPayment: boolean;
}

// Crea una preferencia de pago con Checkout Pro (Preferences API — NO deprecado)
// Si el repartidor tiene su cuenta MP conectada (OAuth), se usa su access_token
// y `marketplace_fee` = comisión de la app → MP divide automáticamente:
//   - Repartidor recibe (total - comisión) a su cuenta MP
//   - Plataforma retiene la comisión
export async function crearPreferenciaAkuo(params: {
  clienteId: string;
  clienteNombre: string;
  email: string;
  monto: number;
  pedidoId: string;
  litros: number;
  comisionApp: number;
  repartidorMpAccessToken?: string | null;
  repartidorMpUserId?: string | null;
  // Nuevo: el modo de split según el plan del transportista
  // - "instant": MP split con pago inmediato (Plan Pro)
  // - "10day": MP split con pago 10 días (Plan Premium)
  // - "none": sin split → la plataforma cobra y paga al transportista via factura (Plan Gratis)
  mpSplitMode?: MpSplitMode;
}): Promise<PreferenciaResult> {
  const mpSplitMode = params.mpSplitMode || "none";

  // 1. Si es modo "none" (Plan Gratis): el pago va completo a la plataforma.
  //    El transportista sube su factura después y la plataforma le paga.
  // 2. Si es modo "10day" o "instant": usar la ÚNICA cuenta MP de split.
  //    La comisión la calcula el backend de AkuoSplash (no MP).
  //    MP solo hace el split: envía al transportista (monto - comisión) y retiene la comisión.
  let accessToken: string | null;
  let userIdPlataforma: string | null;

  if (mpSplitMode === "none") {
    // Sin split → se usa la cuenta legacy/default de la plataforma
    accessToken = params.repartidorMpAccessToken || process.env.AKUO_MP_ACCESS_TOKEN || null;
    userIdPlataforma = process.env.AKUO_MP_USER_ID || null;
    if (!accessToken) throw new Error("AKUO_MP_ACCESS_TOKEN no configurado (necesario para plan Gratis)");
  } else {
    // Split con MP — usar la cuenta única de split
    const creds = await getMpSplitCreds();
    if (!creds.accessToken) {
      throw new Error("MP Split no configurado — pedile al superadmin que lo configure en Integraciones");
    }
    accessToken = creds.accessToken;
    userIdPlataforma = creds.userId;
  }

  const client = new MercadoPagoConfig({ accessToken });
  const preference = new Preference(client);

  let splitPayment = false;
  const body: any = {
    items: [
      {
        id: params.pedidoId,
        title: "AkuoSplash — Pedido de agua",
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
  };

  // Split payment: solo si el repartidor tiene MP conectado (OAuth)
  // Y solo si el plan del repartidor NO es gratis (mpSplitMode !== "none")
  if (mpSplitMode !== "none" && params.repartidorMpAccessToken && params.repartidorMpUserId && userIdPlataforma) {
    body.marketplace_fee = params.comisionApp;
    splitPayment = true;
  }
  // Si mpSplitMode === "none": no agregamos marketplace_fee.
  // El pago va completo a la plataforma; luego el transportista factura.

  const result = await preference.create({ body });

  return {
    preferenceId: result.id!,
    initPoint: result.init_point!,
    splitPayment,
  };
}

// Verifica un pago consultando la API de MP (vía /v1/payments — soportado para queries)
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

// Pago directo con tarjeta via Orders API (sin redirect a MP)
// El cliente ingresa su tarjeta en nuestro sitio, la tokenizamos con la Public Key,
// mandamos el token al backend, y creamos la orden con ese token
export async function crearOrdenDirectaAkuo(params: {
  clienteId: string;
  clienteNombre: string;
  email: string;
  monto: number;
  pedidoId: string;
  litros: number;
  comisionApp: number;
  cardToken: string; // token de la tarjeta (de MP frontend SDK)
  installments?: number; // cuotas (default 1)
  cardFirstSix?: string; // primeros 6 dígitos para inferir el brand
  // Split payment (opcional): si el repartidor tiene MP conectado
  repartidorMpAccessToken?: string | null;
  repartidorMpUserId?: string | null;
  mpSplitMode?: MpSplitMode;
}): Promise<{
  orderId: string;
  status: string; // "approved" | "in_process" | "rejected"
  redirectUrl?: string; // solo si requiere 3DS
  splitPayment: boolean;
  detail?: string;
}> {
  const mpSplitMode = params.mpSplitMode || "none";
  // Seleccionar la cuenta MP según el modo del plan del transportista
  let accessToken: string | null;
  let userIdPlataforma: string | null;
  if (mpSplitMode === "none") {
    accessToken = process.env.AKUO_MP_ACCESS_TOKEN || null;
    userIdPlataforma = process.env.AKUO_MP_USER_ID || null;
  } else {
    const creds = await getMpSplitCreds();
    accessToken = creds.accessToken;
    userIdPlataforma = creds.userId;
  }
  if (!accessToken) throw new Error(`MP ${mpSplitMode} no configurado — pedile al superadmin que lo configure en Integraciones`);

  const idempotencyKey = `akuo-${params.pedidoId}-${Date.now()}`;
  const externalRef = `akuo-pedido-${params.pedidoId}`;

  // Inferir el brand de la tarjeta por el BIN (primeros dígitos)
  // MP Orders API requiere payment_method.id = "visa" | "master" | "amex" | "diners" | "presto"
  const firstDigit = params.cardFirstSix ? params.cardFirstSix[0] : "4";
  let paymentMethodId = "visa";
  if (firstDigit === "5") paymentMethodId = "master";
  else if (firstDigit === "3") paymentMethodId = "amex";

  const body: any = {
    type: "online",
    total_amount: String(params.monto),
    external_reference: externalRef,
    items: [{
      title: "AkuoSplash — Pedido de agua",
      description: `Pedido de ${params.litros} litros`,
      quantity: 1,
      unit_price: String(params.monto),
      category_id: "services",
    }],
    transactions: {
      payments: [{
        amount: String(params.monto),
        payment_method: {
          type: "credit_card",
          id: paymentMethodId, // brand de la tarjeta
          token: params.cardToken, // token de la tarjeta (de MP frontend SDK)
          installments: params.installments || 1, // cuotas
        },
      }],
    },
    payer: {
      email: params.email,
    },
  };

  // Split payment: solo si el repartidor tiene MP conectado Y el plan no es gratis
  let splitPayment = false;
  if (mpSplitMode !== "none" && params.repartidorMpAccessToken && params.repartidorMpUserId && userIdPlataforma) {
    body.splitter = {
      items: [{
        item_id: "1",
        splitter_distributions: [
          {
            collector: { id: Number(params.repartidorMpUserId) },
            amount: String(params.monto - params.comisionApp),
          },
          {
            collector: { id: Number(userIdPlataforma) },
            amount: String(params.comisionApp),
          },
        ],
      }],
    };
    splitPayment = true;
  }

  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    let errMsg = `MP Orders API error ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      const firstError = errJson.errors?.[0] || errJson;
      errMsg = `${errMsg}: ${firstError.message || errJson.message || errText.substring(0, 400)}`;
      if (firstError.details) errMsg += ` — ${firstError.details.join(", ")}`;
    } catch {
      errMsg = `${errMsg}: ${errText.substring(0, 400)}`;
    }
    throw new Error(errMsg);
  }

  const data = await res.json();

  const status = data.status || data.transactions?.payments?.[0]?.status || "unknown";
  const redirectUrl = data.transactions?.payments?.[0]?.redirect_url || data.redirect_url;

  return {
    orderId: String(data.id || ""),
    status,
    redirectUrl,
    splitPayment,
    detail: data.transactions?.payments?.[0]?.status_detail,
  };
}
