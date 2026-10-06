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

// Calcula distancia Haversine entre dos puntos en km
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Verifica si un punto (lat, lng) está dentro de un polígono GeoJSON
function puntoEnPoligono(lat: number, lng: number, geoJsonStr: string): boolean {
  try {
    const geo = JSON.parse(geoJsonStr);
    if (!geo.coordinates || !Array.isArray(geo.coordinates)) return false;
    // Polygon: coordinates[0] = anillo exterior
    const polygon = geo.coordinates[0];
    if (!polygon || polygon.length < 3) return false;
    // Algoritmo ray casting
    let dentro = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-10) + xi);
      if (intersect) dentro = !dentro;
    }
    return dentro;
  } catch {
    return false;
  }
}

// Devuelve la zona aplicable al cliente según su lat/lng
// Si no cae en ninguna zona, devuelve null (se usa el default)
export async function getZonaCliente(lat?: number, lng?: number, comuna?: string): Promise<any | null> {
  const zonas = await akuosplashDb.akuoZona.findMany({ where: { activa: true } });
  // 1) Si hay lat/lng, buscar por polígono
  if (lat !== undefined && lng !== undefined && zonas.length > 0) {
    for (const z of zonas) {
      if (z.zonaGeoJson && z.zonaGeoJson !== '{"type":"Polygon","coordinates":[]}' && puntoEnPoligono(lat, lng, z.zonaGeoJson)) {
        return z;
      }
    }
    // 2) Buscar por radio desde centro
    for (const z of zonas) {
      if (z.centroLat !== null && z.centroLng !== null && z.radioKm) {
        const dist = distanciaKm(lat, lng, z.centroLat, z.centroLng);
        if (dist <= z.radioKm) return z;
      }
    }
  }
  // 3) Si no hay zona geográfica pero hay comuna, intentar match exacto por nombre
  if (comuna && zonas.length > 0) {
    const zonaPorComuna = zonas.find(z => z.nombre.toLowerCase() === comuna.trim().toLowerCase());
    if (zonaPorComuna) return zonaPorComuna;
  }
  return null;
}

// Devuelve el precio por litro para el cliente, basado en su zona (lat/lng o comuna)
// Si no hay zona aplicable, devuelve el default de AkuoConfig
export async function getPrecioPorLitro(lat?: number, lng?: number, comuna?: string): Promise<{ precio: number; zona: any | null; precioDefault: number }> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  const precioDefault = config?.precioPorLitroAguaDefault ?? 50;
  const zona = await getZonaCliente(lat, lng, comuna);
  if (zona) return { precio: zona.precioPorLitro, zona, precioDefault };
  return { precio: precioDefault, zona: null, precioDefault };
}

// Devuelve la comisión de la app en % (configurada por superadmin en AkuoConfig)
export async function getComisionPorcentaje(): Promise<number> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  return config?.comisionPorcentaje ?? 0;
}

// Calcula el monto total que paga el cliente:
// litros × precioPorLitro + comisión% sobre ese subtotal
export async function calcularPrecioTotal(litros: number, lat?: number, lng?: number, comuna?: string): Promise<{ subtotal: number; comision: number; total: number; precioPorLitro: number; comisionPct: number; zonaNombre: string | null }> {
  const { precio, zona } = await getPrecioPorLitro(lat, lng, comuna);
  const subtotal = Math.round(litros * precio);
  const comisionPct = await getComisionPorcentaje();
  const comision = Math.round((subtotal * comisionPct) / 100);
  return { subtotal, comision, total: subtotal + comision, precioPorLitro: precio, comisionPct, zonaNombre: zona?.nombre || null };
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
