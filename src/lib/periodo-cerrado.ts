// Helper para verificar si una fecha está en un período cerrado.
// Un período está cerrado si la configuración tiene ultimoCierre y la fecha
// de la entrega/gasto/pago es anterior a ultimoCierre.
import { db } from "@/lib/db";
import { getDuenoId } from "@/lib/auth";

// Cache simple en memoria: duenoId -> { ultimoCierre, ts }
const cierreCache = new Map<string, { ultimoCierre: Date | null; ts: number }>();
const CIERRE_CACHE_TTL = 60_000; // 60 segundos

// Obtiene la fecha de último cierre del admin actual.
// Usa cache de 60s para no saturar la DB en cada request de escritura.
export async function getUltimoCierre(): Promise<Date | null> {
  const duenoId = await getDuenoId();
  if (!duenoId) return null;

  const now = Date.now();
  const cached = cierreCache.get(duenoId);
  if (cached && now - cached.ts < CIERRE_CACHE_TTL) {
    return cached.ultimoCierre;
  }

  try {
    const config = await db.configuracion.findUnique({
      where: { duenoId },
      select: { ultimoCierre: true },
    });
    const ultimoCierre = config?.ultimoCierre ?? null;
    cierreCache.set(duenoId, { ultimoCierre, ts: now });
    return ultimoCierre;
  } catch {
    return null;
  }
}

// Verifica si una fecha específica está en un período cerrado.
// Retorna true si la fecha es anterior al último cierre.
export async function isFechaEnPeriodoCerrado(fecha: Date): Promise<boolean> {
  const ultimoCierre = await getUltimoCierre();
  if (!ultimoCierre) return false;
  return new Date(fecha) < ultimoCierre;
}

// Verifica si el período actual está cerrado (no se pueden registrar cosas nuevas).
// Esto pasa cuando el último cierre es hoy o en el pasado reciente.
export async function isPeriodoActualCerrado(): Promise<boolean> {
  const ultimoCierre = await getUltimoCierre();
  if (!ultimoCierre) return false;
  // El período está cerrado si el último cierre fue hoy o después
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return new Date(ultimoCierre) >= hoy;
}

// Limpia el cache (útil cuando se cierra un período manualmente)
export function clearCierreCache() {
  cierreCache.clear();
}
