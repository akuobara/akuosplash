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

function getBaseUrl(creds: TransbankCreds): string {
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
