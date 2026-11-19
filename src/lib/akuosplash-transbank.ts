/**
 * Cliente para Transbank Webpay REST API.
 * Documentación: https://www.transbankdevelopers.cl/pl/reference/webpay
 *
 * Soporta:
 * - createTransaction: crear una transacción → devuelve { token, url } para redirigir
 * - commitTransaction: confirmar después del redirect
 * - getStatus: consultar estado sin commit
 * - refund: revertir
 *
 * Las credenciales se leen de AkuoConfig (DB) primero, fallback a env vars:
 * - TRANSBANK_COMMERCE_CODE
 * - TRANSBANK_API_KEY
 * - TRANSBANK_ENVIRONMENT ("INTEGRACION" | "PRODUCCION")
 */

import { akuosplashDb } from "./akuosplash-db";

const URL_INTEGRACION = "https://webpay3gint.transbank.cl";
const URL_PRODUCCION = "https://webpay3g.transbank.cl";

export interface TransbankCreds {
  commerceCode: string;
  apiKey: string;
  environment: "INTEGRACION" | "PRODUCCION";
}

export async function getTransbankCreds(): Promise<TransbankCreds | null> {
  // DB primero
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (config?.transbankCommerceCode && config?.transbankApiKey) {
    return {
      commerceCode: config.transbankCommerceCode,
      apiKey: config.transbankApiKey,
      environment: (config.transbankEnvironment as "INTEGRACION" | "PRODUCCION") || "INTEGRACION",
    };
  }
  // Fallback a env vars
  const envCode = process.env.TRANSBANK_COMMERCE_CODE;
  const envKey = process.env.TRANSBANK_API_KEY;
  const envEnv = (process.env.TRANSBANK_ENVIRONMENT as "INTEGRACION" | "PRODUCCION") || "INTEGRACION";
  if (envCode && envKey) {
    return { commerceCode: envCode, apiKey: envKey, environment: envEnv };
  }
  return null;
}

function getBaseUrl(creds: { environment: "INTEGRACION" | "PRODUCCION" }): string {
  return creds.environment === "PRODUCCION" ? URL_PRODUCCION : URL_INTEGRACION;
}

export interface CreateTransactionParams {
  buyOrder: string; // identificador único (max 26 chars)
  sessionId: string; // identificador de sesión (max 80 chars)
  amount: number; // en pesos chilenos (min 50, max 999999999)
  returnUrl: string; // URL de retorno (max 255 chars)
}

export interface CreateTransactionResult {
  token: string;
  url: string; // URL a la que redirigir al usuario
}

/**
 * Crea una transacción Webpay.
 * Lanza error si las credenciales no están configuradas o si Transbank rechaza.
 */
export async function createTransaction(params: CreateTransactionParams): Promise<CreateTransactionResult> {
  const creds = await getTransbankCreds();
  if (!creds) {
    throw new Error("Transbank no configurado. Configuralo en superadmin → Integraciones → Transbank.");
  }

  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions`;

  const body = {
    buy_order: params.buyOrder,
    session_id: params.sessionId,
    amount: params.amount,
    return_url: params.returnUrl,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": creds.commerceCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Transbank createTransaction HTTP ${res.status}: ${JSON.stringify(data)}`);
  }

  if (!data.token || !data.url) {
    throw new Error(`Respuesta Transbank inválida: ${JSON.stringify(data)}`);
  }

  return { token: data.token, url: data.url };
}

export interface CommitResult {
  vci: string;
  amount: number;
  status: string; // "AUTHORIZED" | "FAILED" | "REJECTED" | "NULLIFIED" | ...
  buy_order: string;
  session_id: string;
  card_detail?: { card_type: string; card_number: string };
  accounting_date: string;
  transaction_date: string;
  authorization_code: string | null;
  payment_type_code: string;
  response_code: number | null;
  installments_number: number;
}

/**
 * Confirma la transacción después de que Transbank redirige de vuelta con el token.
 */
export async function commitTransaction(tokenWs: string): Promise<CommitResult> {
  const creds = await getTransbankCreds();
  if (!creds) {
    throw new Error("Transbank no configurado.");
  }
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions/${encodeURIComponent(tokenWs)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Tbk-Api-Key-Id": creds.commerceCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Transbank commitTransaction HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as CommitResult;
}

/**
 * Obtiene el estado de una transacción sin confirmar (para debug).
 */
export async function getStatus(tokenWs: string): Promise<CommitResult> {
  const creds = await getTransbankCreds();
  if (!creds) throw new Error("Transbank no configurado.");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions/${encodeURIComponent(tokenWs)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Tbk-Api-Key-Id": creds.commerceCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Transbank getStatus HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as CommitResult;
}

/**
 * Reembolsa una transacción confirmada.
 */
export async function refundTransaction(tokenWs: string, amount: number): Promise<any> {
  const creds = await getTransbankCreds();
  if (!creds) throw new Error("Transbank no configurado.");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/webpay/v1.2/transactions/${encodeURIComponent(tokenWs)}/refund`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": creds.commerceCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Transbank refund HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Genera un buy_order único para una subscripción.
 * Formato: "AKUO-SUB-{userId}-{timestamp}" — max 26 chars (Transbank limit).
 */
export function generateBuyOrder(userId: string): string {
  // Tomar primeros 8 chars del userId + últimos 6 del timestamp
  const shortUserId = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-8);
  return `AKS${shortUserId}${ts}`.slice(0, 26);
}

// ============================================================================
// Transbank Oneclick Mall — inscripción de tarjeta + cobro recurrente
// Docs: https://www.transbankdevelopers.cl/documentacion/oneclick
//
// Flujo:
//   1. startInscription → { token, url } → redirigir usuario a `url`
//   2. Usuario inscribe tarjeta en Webpay → Transbank redirige a response_url con tbk_token
//   3. finishInscription(tbk_token) → { response_code, tbk_user, card_type, card_number }
//   4. authorize({ username, tbk_user, buy_order, amount }) → cobra desde el backend (recurrente)
//   5. refund({ buy_order, amount }) → revierte un cargo
//   6. deleteInscription({ username, tbk_user }) → desinscribe la tarjeta
// ============================================================================

export interface OneclickCreds {
  mallCode: string;      // código de comercio padre (mall)
  childCode: string;     // código de comercio hijo (store)
  apiKey: string;        // API key (compartida con Webpay Plus en integración)
  environment: "INTEGRACION" | "PRODUCCION";
}

export async function getOneclickCreds(): Promise<OneclickCreds | null> {
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (config?.transbankOneclickMallCode && config?.transbankOneclickChildCode && config?.transbankApiKey) {
    return {
      mallCode: config.transbankOneclickMallCode,
      childCode: config.transbankOneclickChildCode,
      apiKey: config.transbankApiKey,
      environment: (config.transbankEnvironment as "INTEGRACION" | "PRODUCCION") || "INTEGRACION",
    };
  }
  // Fallback a env vars
  const mall = process.env.TRANSBANK_ONECLICK_MALL_CODE;
  const child = process.env.TRANSBANK_ONECLICK_CHILD_CODE;
  const apiKey = process.env.TRANSBANK_API_KEY;
  const envEnv = (process.env.TRANSBANK_ENVIRONMENT as "INTEGRACION" | "PRODUCCION") || "INTEGRACION";
  if (mall && child && apiKey) {
    return { mallCode: mall, childCode: child, apiKey, environment: envEnv };
  }
  return null;
}

// --- 1. Start inscription ---
export interface StartInscriptionParams {
  username: string;     // max 40 chars, identificador único del tarjetahabiente
  responseUrl: string;  // URL pública a la que Transbank redirige tras inscribir (max 255)
  email: string;        // email del tarjetahabiente
}
export interface StartInscriptionResult {
  token: string;  // tbk_token para llamar finish
  url: string;    // URL a la que redirigir al usuario para inscribir su tarjeta
}

export async function startInscription(params: StartInscriptionParams): Promise<StartInscriptionResult> {
  const creds = await getOneclickCreds();
  if (!creds) throw new Error("Oneclick no configurado. Configuralo en superadmin → Integraciones → Transbank (códigos Oneclick Mall).");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/oneclick/v1.2/inscriptions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": creds.mallCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: params.username,
      response_url: params.responseUrl,
      email: params.email,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Oneclick start HTTP ${res.status}: ${JSON.stringify(data)}`);
  // Oneclick devuelve "url_webpay" (no "url" como Webpay Plus)
  const urlWebpay = data.url_webpay || data.url;
  if (!data.token || !urlWebpay) throw new Error(`Oneclick start respuesta inválida: ${JSON.stringify(data)}`);
  return { token: data.token, url: urlWebpay };
}

// --- 2. Finish inscription ---
export interface FinishInscriptionResult {
  responseCode: number;       // 0 = éxito
  tbkUser: string;            // token para authorize (guardar en DB)
  authorizationCode: string;
  cardType: string;           // Visa | MasterCard | AmericanExpress | ...
  cardNumber: string;         // últimos 4 dígitos
}

export async function finishInscription(token: string): Promise<FinishInscriptionResult> {
  const creds = await getOneclickCreds();
  if (!creds) throw new Error("Oneclick no configurado.");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/oneclick/v1.2/inscriptions/${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Tbk-Api-Key-Id": creds.mallCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Oneclick finish HTTP ${res.status}: ${JSON.stringify(data)}`);
  return {
    responseCode: data.response_code,
    tbkUser: data.tbk_user,
    authorizationCode: data.authorization_code,
    cardType: data.card_type,
    cardNumber: data.card_number,
  };
}

// --- 3. Authorize (cargo con tarjeta inscripta, recurrente) ---
export interface AuthorizeParams {
  username: string;
  tbkUser: string;
  buyOrder: string;       // max 26, identificador único del cargo
  childBuyOrder: string;  // max 26, identificador del detalle (child)
  amount: number;         // en pesos chilenos
  installments?: number;  // 0 = sin cuotas (default)
}
export interface AuthorizeResult {
  ok: boolean;
  responseCode: number;       // 0 = aprobado
  authorizationCode: string;
  buyOrder: string;
  cardNumber: string;
  amount: number;
}

export async function authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
  const creds = await getOneclickCreds();
  if (!creds) throw new Error("Oneclick no configurado.");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/oneclick/v1.2/transactions`;
  const body = {
    username: params.username,
    tbk_user: params.tbkUser,
    buy_order: params.buyOrder,
    details: [
      {
        commerce_code: creds.childCode,
        buy_order: params.childBuyOrder,
        amount: params.amount,
        installments: params.installments ?? 0,
      },
    ],
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": creds.mallCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Oneclick authorize HTTP ${res.status}: ${JSON.stringify(data)}`);
  const detail = data.details?.[0];
  if (!detail) throw new Error(`Oneclick authorize sin detalle: ${JSON.stringify(data)}`);
  return {
    ok: detail.response_code === 0,
    responseCode: detail.response_code,
    authorizationCode: detail.authorization_code,
    buyOrder: detail.buy_order,
    cardNumber: detail.card_number,
    amount: detail.amount,
  };
}

// --- 4. Refund (revierte un cargo confirmado) ---
export interface RefundParams {
  buyOrder: string;       // buy_order del cargo original (nivel mall)
  childBuyOrder: string;  // buy_order del detalle (child)
  amount: number;
}
export interface RefundResult {
  ok: boolean;
  responseCode: number;
  type: string;  // "REVERSED" | "NULLIFIED"
}

export async function refund(params: RefundParams): Promise<RefundResult> {
  const creds = await getOneclickCreds();
  if (!creds) throw new Error("Oneclick no configurado.");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/oneclick/v1.2/transactions/${encodeURIComponent(params.buyOrder)}/refunds`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Tbk-Api-Key-Id": creds.mallCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      detail: [
        {
          commerce_code: creds.childCode,
          buy_order: params.childBuyOrder,
          amount: params.amount,
        },
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Oneclick refund HTTP ${res.status}: ${JSON.stringify(data)}`);
  const detail = data.details?.[0] || data;
  return {
    ok: detail.response_code === 0 || data.type === "REVERSED" || data.type === "NULLIFIED",
    responseCode: detail.response_code ?? 0,
    type: data.type,
  };
}

// --- 5. Delete inscription (desinscribe la tarjeta) ---
export interface DeleteInscriptionResult {
  ok: boolean;
  code: number;  // 204 = desinscripto
}

export async function deleteInscription(username: string, tbkUser: string): Promise<DeleteInscriptionResult> {
  const creds = await getOneclickCreds();
  if (!creds) throw new Error("Oneclick no configurado.");
  const baseUrl = getBaseUrl(creds);
  const url = `${baseUrl}/rswebpaytransaction/api/oneclick/v1.2/inscriptions`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Tbk-Api-Key-Id": creds.mallCode,
      "Tbk-Api-Key-Secret": creds.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, tbk_user: tbkUser }),
  });
  if (res.status === 204) return { ok: true, code: 204 };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Oneclick delete HTTP ${res.status}: ${JSON.stringify(data)}`);
  return { ok: true, code: res.status };
}

/**
 * Genera un username Oneclick desde un userId (max 40 chars, alfanumérico).
 * Formato: "akuo_" + últimos 34 chars alfanuméricos del userId.
 */
export function generateOneclickUsername(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(-34);
  return `akuo_${clean}`.slice(0, 40);
}

/**
 * Genera un child buy_order (para el detalle de authorize) — distinto del buy_order mall.
 */
export function generateChildBuyOrder(buyOrder: string): string {
  return (buyOrder + "C").slice(0, 26);
}
