// Tipos y helpers compartidos

export const TIPOS_GASTO = [
  { value: "agua_planta", label: "Carga de agua en planta" },
  { value: "combustible_camion", label: "Combustible camión" },
  { value: "combustible_motobomba", label: "Combustible motobomba" },
  { value: "cloro", label: "Cloro para tratar agua" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "otro", label: "Otro" },
] as const;

export const ESTADOS_PAGO = [
  { value: "pendiente", label: "Pendiente" },
  { value: "parcial", label: "Parcial" },
  { value: "pagado", label: "Pagado" },
] as const;

export const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "mixto", label: "Mixto (efectivo + transferencia)" },
  { value: "credito", label: "Crédito (pendiente)" },
] as const;

export const PAGADO_POR = [
  { value: "chofer", label: "Chofer" },
  { value: "dueno", label: "Dueño" },
] as const;

export const MODOS_LIQUIDACION = [
  { value: "porcentaje", label: "Porcentaje de utilidad" },
  { value: "vuelta", label: "Pago por vuelta entregada" },
] as const;

export const ESTADOS_PEDIDO = [
  { value: "pendiente", label: "Pendiente", color: "amber" },
  { value: "programado", label: "Programado", color: "blue" },
  { value: "en_ruta", label: "En ruta", color: "purple" },
  { value: "entregado", label: "Entregado", color: "emerald" },
  { value: "cancelado", label: "Cancelado", color: "muted" },
] as const;

export const TIPOS_ASIGNACION = [
  { value: "manual", label: "Asignar a chofer específico", description: "El dueño elige qué chofer entrega" },
  { value: "publicado", label: "Publicar para choferes", description: "Disponible para que cualquier chofer lo tome" },
] as const;

export const TIPOS_PRIORIDAD = [
  { value: "ninguna", label: "Sin prioridad" },
  { value: "permanente", label: "Prioridad permanente" },
  { value: "caso", label: "Prioridad por este caso" },
] as const;

export const USOS_AGUA = [
  { value: "consumo", label: "Consumo doméstico", description: "Agua para beber, cocinar, bañarse" },
  { value: "riego_pasto", label: "Riego de pasto/jardín", description: "Regar pasto, plantas, jardines" },
  { value: "riego_cultivos", label: "Riego de cultivos", description: "Regar huerta, cultivos agrícolas" },
  { value: "polvo_caminos", label: "Humedecer polvo de caminos", description: "Bajar el polvo en caminos de tierra" },
  { value: "construccion", label: "Construcción", description: "Mezcla, curado, limpieza de obras" },
  { value: "piscina", label: "Llenado de piscina", description: "Llenar o rellenar piscina" },
  { value: "otro", label: "Otro", description: "Otro uso específico" },
] as const;

export const TIPOS_ESTANQUE = [
  { value: "estanque", label: "Estanque (sobre tierra)" },
  { value: "estanque_subterraneo", label: "Estanque subterráneo / cisterna" },
  { value: "tinaco", label: "Tinaco (elevado)" },
  { value: "piscina", label: "Piscina" },
  { value: "otro", label: "Otro" },
] as const;

export const TIPOS_TRIBUTO = [
  { value: "boleta_honorarios", label: "Boleta de honorarios", description: "Retención + cotización previsional" },
  { value: "factura", label: "Factura electrónica", description: "IVA y/o retención" },
  { value: "otro", label: "Otro tributo", description: "Configura el porcentaje manualmente" },
  { value: "ninguno", label: "Sin impuestos", description: "No aplica retención" },
] as const;

export const APLICA_IMPUESTO_SOBRE = [
  { value: "pago_chofer", label: "Pago al chofer (líquido)", description: "Ej. boleta de honorarios sobre el fee del chofer" },
  { value: "utilidad_bruta", label: "Utilidad bruta (ventas − gastos)", description: "El tributo se calcula sobre la utilidad" },
  { value: "ventas_brutas", label: "Ventas brutas", description: "El tributo se calcula sobre el total vendido" },
] as const;

export function labelTipoGasto(tipo: string): string {
  return TIPOS_GASTO.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelEstadoPago(estado: string): string {
  return ESTADOS_PAGO.find((e) => e.value === estado)?.label ?? estado;
}

export function labelMetodoPago(metodo: string): string {
  return METODOS_PAGO.find((m) => m.value === metodo)?.label ?? metodo;
}

export function labelPagadoPor(quien: string): string {
  return PAGADO_POR.find((p) => p.value === quien)?.label ?? quien;
}

export function labelModoLiquidacion(modo: string): string {
  return MODOS_LIQUIDACION.find((m) => m.value === modo)?.label ?? modo;
}

export function labelEstadoPedido(estado: string): string {
  return ESTADOS_PEDIDO.find((e) => e.value === estado)?.label ?? estado;
}

export function labelFranjaHoraria(franja: string | null | undefined): string {
  if (!franja) return "";
  // Formato: "manana", "mediodia", "tarde", "antes:14", "despues:9"
  if (franja.startsWith("antes:")) {
    const hora = franja.split(":")[1];
    return `Antes de las ${hora}:00`;
  }
  if (franja.startsWith("despues:")) {
    const hora = franja.split(":")[1];
    return `Después de las ${hora}:00`;
  }
  const labels: Record<string, string> = {
    "manana": "Mañana (08-12)",
    "mediodia": "Mediodía (11-13)",
    "tarde": "Tarde (14-18)",
  };
  return labels[franja] || franja;
}

export function labelTipoAsignacion(tipo: string): string {
  return TIPOS_ASIGNACION.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelTipoPrioridad(tipo: string): string {
  return TIPOS_PRIORIDAD.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelUsoAgua(uso: string): string {
  return USOS_AGUA.find((u) => u.value === uso)?.label ?? uso;
}

export function labelTipoEstanque(tipo: string): string {
  return TIPOS_ESTANQUE.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelTipoTributo(tipo: string): string {
  return TIPOS_TRIBUTO.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelAplicaImpuestoSobre(sobre: string): string {
  return APLICA_IMPUESTO_SOBRE.find((a) => a.value === sobre)?.label ?? sobre;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0";
  // Si el valor tiene decimales significativos, mostrarlos (ej. precio por litro: 8.7)
  const hasDecimals = value % 1 !== 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value || 0);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

// Versión de formatDate que interpreta la fecha como "el día del ISO string" (YYYY-MM-DD)
// sin convertirla a zona horaria local. Útil para fechas que se guardan como
// "YYYY-MM-DDT00:00:00Z" y que el usuario quiere ver como "el día YYYY-MM-DD"
// (sin importar su zona horaria). Ej: pedido recurrente para "4 de septiembre"
// se guarda como 2026-09-04T00:00:00Z y debe mostrarse como "04-09-2024", no "03-09".
export function formatDateUTC(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const isoStr = typeof date === "string" ? date : date.toISOString();
  const yyyyMmDd = isoStr.split("T")[0];
  if (!yyyyMmDd) return formatDate(date);
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}-${m}-${y}`;
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

// Hora actual en Chile con formato legible (para reportes)
export function formatNowCL(): string {
  return new Date().toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });
}

// Formatea una fecha para un input datetime-local (sin zona horaria)
// Convierte a hora LOCAL, no UTC — evita el desfase de 4 horas en Chile
export function toDateTimeLocalInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

// Convierte un valor de input datetime-local (ej. "2024-01-15T14:30") a un objeto Date.
// El valor del input se interpreta como hora LOCAL del servidor.
// Si ya viene como ISO completo (con zona horaria), se parsea directamente.
export function parseDateTimeLocalInput(value: string): Date {
  // Si ya incluye zona horaria (Z o +XX:XX), parsear directamente
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  // Si ya incluye segundos, no añadirlos
  const hasSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  const normalized = hasSeconds ? value : value + ":00";
  // new Date("2024-01-15T14:30:00") interpreta como hora LOCAL en Node.js
  return new Date(normalized);
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// === Completación de vuelta ===
// Una vuelta se considera completada (válida para liquidación) cuando se han
// entregado al menos el 97.5% de la capacidad del camión.
// Si no se conoce la capacidad del camión, se considera completada si tuvo
// al menos una entrega (para no penalizar vueltas antiguas sin camión asignado).
export const UMBRAL_COMPLETACION_VUELTA = 0.975;

export function esVueltaCompletada(
  litros: number,
  capacidadCamion: number | null | undefined,
  cantidadEntregas: number = 0,
  umbral: number = UMBRAL_COMPLETACION_VUELTA,
  // Si la vuelta fue validada manualmente, cuenta como completada
  validadaManualmente?: boolean | null,
): boolean {
  // Si fue validada manualmente, cuenta como completada
  if (validadaManualmente === true) return true;
  // Si no, aplicar umbral (97.5% del camión)
  if (capacidadCamion && capacidadCamion > 0) {
    return litros >= capacidadCamion * umbral;
  }
  return litros >= 1000 && cantidadEntregas > 0;
}

export function porcentajeCompletado(
  litros: number,
  capacidadCamion: number | null | undefined
): number {
  if (!capacidadCamion || capacidadCamion <= 0) return 0;
  return (litros / capacidadCamion) * 100;
}

// Devuelve un rango de fechas para el período solicitado
// IMPORTANTE: usa zona horaria de Chile (America/Santiago) para que "hoy"
// coincida con el día local del usuario, no con el día UTC del servidor.
export function getRange(period: string): { start?: Date; end?: Date } {
  // Obtener "hoy" en zona horaria Chile (UTC-4)
  const nowCL = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const year = nowCL.getFullYear();
  const month = nowCL.getMonth();
  const date = nowCL.getDate();

  // Crear fechas en UTC pero ajustadas al día de Chile (00:00 Chile = 04:00 UTC)
  // Usamos Date.UTC para evitar que el servidor interprete la fecha en su zona local
  function chileDayStart(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m, d, 4, 0, 0)); // 00:00 Chile = 04:00 UTC
  }
  function chileDayEnd(y: number, m: number, d: number): Date {
    return new Date(Date.UTC(y, m, d + 1, 4, 0, 0)); // 00:00 día siguiente Chile
  }

  if (period === "hoy") {
    return { start: chileDayStart(year, month, date), end: chileDayEnd(year, month, date) };
  }
  if (period === "ayer") {
    return { start: chileDayStart(year, month, date - 1), end: chileDayStart(year, month, date) };
  }
  if (period === "semana") {
    const dayOfWeek = nowCL.getDay();
    return { start: chileDayStart(year, month, date - dayOfWeek), end: chileDayEnd(year, month, date - dayOfWeek + 6) };
  }
  if (period === "semana7") {
    return { start: chileDayStart(year, month, date - 6), end: chileDayEnd(year, month, date) };
  }
  if (period === "mes") {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return { start: chileDayStart(year, month, 1), end: chileDayEnd(year, month, lastDay) };
  }
  if (period === "mes_anterior") {
    const prevMonth = new Date(year, month, 0);
    const lastDay = prevMonth.getDate();
    return { start: chileDayStart(prevMonth.getFullYear(), prevMonth.getMonth(), 1), end: chileDayEnd(prevMonth.getFullYear(), prevMonth.getMonth(), lastDay) };
  }
  if (period === "mes3") {
    return { start: chileDayStart(year, month - 2, 1), end: chileDayEnd(year, month, date) };
  }
  if (period.startsWith("custom:")) {
    // Formato: custom:YYYY-MM-DD:YYYY-MM-DD
    const parts = period.split(":");
    if (parts.length === 3) {
      const start = new Date(parts[1] + "T00:00:00-04:00"); // hora Chile
      const end = new Date(parts[2] + "T23:59:59-04:00");
      return { start, end };
    }
  }
  // "todo" o desconocido
  return {};
}

// === DÍA DE LA SEMANA PREFERIDO PARA RECURRENTES SEMANALES ===
// Día nombres para UI
export const DIAS_SEMANA = [
  { value: 0, label: "Domingo", corto: "Dom" },
  { value: 1, label: "Lunes", corto: "Lun" },
  { value: 2, label: "Martes", corto: "Mar" },
  { value: 3, label: "Miércoles", corto: "Mié" },
  { value: 4, label: "Jueves", corto: "Jue" },
  { value: 5, label: "Viernes", corto: "Vie" },
  { value: 6, label: "Sábado", corto: "Sáb" },
];

export function labelDiaSemana(dia: number | null | undefined): string {
  if (dia === null || dia === undefined) return "—";
  return DIAS_SEMANA[dia]?.label || "—";
}

// Calcula la próxima fecha de generación respetando el día de la semana preferido.
// Casos:
// 1. diaSemanaPreferido = null/undefined o frecuenciaDias !== 7:
//    → avanzar fechaActual + frecuenciaDias (comportamiento clásico)
// 2. diaSemanaPreferido seteado y frecuenciaDias === 7:
//    → avanzar al próximo día de la semana preferido que sea > (fechaActual + 6 días)
//    (es decir, siempre "próxima semana", no la misma semana)
//
// Ej: si fechaActual = Wed 2026-09-29 (miércoles) y diaSemanaPreferido = 5 (viernes):
//    → próxima = Fri 2026-10-02 (el viernes de esta semana, ya que el miércoles es antes del viernes)
//    pero si fechaActual = Fri 2026-09-26 y diaSemanaPreferido = 5 (viernes):
//    → próxima = Fri 2026-10-02 (próximo viernes, no hoy mismo)
//
// Para asegurar "siempre próxima semana" cuando el día preferido ya pasó o es hoy,
// sumamos 7 días primero y luego ajustamos al día preferido.
export function calcularProximaFechaConDiaPreferido(
  fechaActual: Date,
  frecuenciaDias: number,
  diaSemanaPreferido: number | null | undefined
): Date {
  // Caso 1: sin día preferido o frecuencia no semanal
  if (diaSemanaPreferido === null || diaSemanaPreferido === undefined || frecuenciaDias !== 7) {
    const proxima = new Date(fechaActual);
    proxima.setDate(proxima.getDate() + frecuenciaDias);
    // Ajustar a medianoche UTC para evitar problemas de timezone
    proxima.setUTCHours(0, 0, 0, 0);
    return proxima;
  }

  // Caso 2: día preferido + frecuencia 7
  // Avanzar 7 días (próxima semana) y luego ajustar al día preferido
  const proxima = new Date(fechaActual);
  proxima.setDate(proxima.getDate() + 7);
  const diaActual = proxima.getDay();
  const diff = (diaSemanaPreferido - diaActual + 7) % 7;
  proxima.setDate(proxima.getDate() + diff);
  proxima.setUTCHours(0, 0, 0, 0);
  return proxima;
}

// Snap a día de la semana preferido desde una fecha dada (hacia adelante).
// Útil para "realinear" la fechaProximaGeneracion al día correcto cuando
// una entrega se hizo fuera del día preferido.
// Si la fechaActual ya es el día preferido, devuelve la misma fecha.
// Si la fechaActual es antes del día preferido en la misma semana, devuelve ese día.
// Si la fechaActual es después del día preferido, devuelve el día preferido de la próxima semana.
export function snapADiaSemanaPreferido(fechaActual: Date, diaSemanaPreferido: number): Date {
  const resultado = new Date(fechaActual);
  const diaActual = resultado.getDay();
  let diff = (diaSemanaPreferido - diaActual + 7) % 7;
  resultado.setDate(resultado.getDate() + diff);
  resultado.setUTCHours(0, 0, 0, 0);
  return resultado;
}
