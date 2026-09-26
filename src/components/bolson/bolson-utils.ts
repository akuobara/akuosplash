// Bolsón — utilidades compartidas entre todas las interfaces
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formateadores CLP
export function formatCLP(monto: number | null | undefined): string {
  if (!monto && monto !== 0) return "$—";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(monto);
}

export function formatNumber(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function formatFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  try {
    const d = typeof fecha === "string" ? new Date(fecha) : fecha;
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Santiago",
    });
  } catch {
    return String(fecha);
  }
}

export function formatFechaCorta(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  try {
    const d = typeof fecha === "string" ? new Date(fecha) : fecha;
    return d.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Santiago",
    });
  } catch {
    return String(fecha);
  }
}

export function labelCategoria(slug: string): string {
  const map: Record<string, string> = {
    flete: "Flete",
    mudanza: "Mudanza",
    escombros: "Escombros",
  };
  return map[slug] || slug;
}

export function labelEstadoSolicitud(estado: string): string {
  const map: Record<string, string> = {
    abierta: "Abierta — recibiendo cotizaciones",
    adjudicada: "Adjudicada",
    en_progreso: "En progreso",
    entregada: "Entregada",
    cancelada: "Cancelada",
    vencida: "Vencida",
  };
  return map[estado] || estado;
}

export function colorEstadoSolicitud(estado: string): string {
  const map: Record<string, string> = {
    abierta: "bg-amber-100 text-amber-800 border-amber-300",
    adjudicada: "bg-emerald-100 text-emerald-800 border-emerald-300",
    en_progreso: "bg-blue-100 text-blue-800 border-blue-300",
    entregada: "bg-gray-100 text-gray-800 border-gray-300",
    cancelada: "bg-red-100 text-red-800 border-red-300",
    vencida: "bg-orange-100 text-orange-800 border-orange-300",
  };
  return map[estado] || "bg-gray-100 text-gray-800 border-gray-300";
}

export function labelEstadoServicio(estado: string): string {
  const map: Record<string, string> = {
    asignado: "Asignado — pendiente de iniciar",
    en_camino_carga: "En camino al punto de carga",
    cargado: "Cargado — en ruta",
    en_camino_entrega: "En camino al punto de entrega",
    entregado: "Entregado — pendiente confirmar",
    completado: "Completado",
    cancelado: "Cancelado",
  };
  return map[estado] || estado;
}

export function colorEstadoServicio(estado: string): string {
  const map: Record<string, string> = {
    asignado: "bg-amber-100 text-amber-800 border-amber-300",
    en_camino_carga: "bg-yellow-100 text-yellow-800 border-yellow-300",
    cargado: "bg-lime-100 text-lime-800 border-lime-300",
    en_camino_entrega: "bg-emerald-100 text-emerald-800 border-emerald-300",
    entregado: "bg-blue-100 text-blue-800 border-blue-300",
    completado: "bg-green-700 text-white border-green-800",
    cancelado: "bg-red-100 text-red-800 border-red-300",
  };
  return map[estado] || "bg-gray-100 text-gray-800 border-gray-300";
}

// API client wrapper
export async function bolsonApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`) as Error & {
      status?: number;
      data?: any;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export async function bolsonGet<T = any>(path: string): Promise<T> {
  return bolsonApi<T>(path, { method: "GET" });
}

export async function bolsonPost<T = any>(path: string, body?: any): Promise<T> {
  return bolsonApi<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function bolsonPatch<T = any>(path: string, body: any): Promise<T> {
  return bolsonApi<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

export async function bolsonDelete<T = any>(path: string): Promise<T> {
  return bolsonApi<T>(path, { method: "DELETE" });
}
