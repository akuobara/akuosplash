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

export function labelTipoTributo(tipo: string): string {
  return TIPOS_TRIBUTO.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelAplicaImpuestoSobre(sobre: string): string {
  return APLICA_IMPUESTO_SOBRE.find((a) => a.value === sobre)?.label ?? sobre;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
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
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Devuelve un rango de fechas para el día/semana/mes actual
export function getRange(period: "hoy" | "semana" | "mes" | "todo"): { start?: Date; end?: Date } {
  const now = new Date();
  if (period === "hoy") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end };
  }
  if (period === "semana") {
    const day = now.getDay() === 0 ? 7 : now.getDay();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  if (period === "mes") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }
  return {};
}
