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

export function formatCurrency(value: number): string {
  // Si el valor tiene decimales significativos, mostrarlos (ej. precio por litro: 8.7)
  const hasDecimals = value % 1 !== 0;
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: hasDecimals ? 1 : 0,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value || 0);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Santiago",
  });
}

export function formatDateTime(date: Date | string): string {
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

export function formatTime(date: Date | string): string {
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
  umbral: number = UMBRAL_COMPLETACION_VUELTA
): boolean {
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
  // Obtener "hoy" en zona horaria Chile
  const nowCL = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const year = nowCL.getFullYear();
  const month = nowCL.getMonth();
  const date = nowCL.getDate();

  if (period === "hoy") {
    const start = new Date(year, month, date);
    const end = new Date(year, month, date + 1);
    return { start, end };
  }
  if (period === "ayer") {
    const start = new Date(year, month, date - 1);
    const end = new Date(year, month, date);
    return { start, end };
  }
  if (period === "semana") {
    // Semana actual: domingo a sábado
    const dayOfWeek = nowCL.getDay(); // 0=domingo, 1=lunes, ...
    const start = new Date(year, month, date - dayOfWeek);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  if (period === "semana7") {
    // Últimos 7 días
    const start = new Date(year, month, date - 6);
    const end = new Date(year, month, date + 1);
    return { start, end };
  }
  if (period === "mes") {
    // Mes actual: día 1 al último día
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    return { start, end };
  }
  if (period === "mes_anterior") {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { start, end };
  }
  if (period === "mes3") {
    // Últimos 3 meses
    const start = new Date(year, month - 2, 1);
    const end = new Date(year, month + 1, 1);
    return { start, end };
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
