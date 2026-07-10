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

export function labelTipoGasto(tipo: string): string {
  return TIPOS_GASTO.find((t) => t.value === tipo)?.label ?? tipo;
}

export function labelEstadoPago(estado: string): string {
  return ESTADOS_PAGO.find((e) => e.value === estado)?.label ?? estado;
}

export function formatCurrency(value: number): string {
  // Formato peso chileno — sin decimales por defecto
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

// Devuelve un rango de fechas para el día/semana/mes actual
export function getRange(period: "hoy" | "semana" | "mes" | "todo"): { start?: Date; end?: Date } {
  const now = new Date();
  if (period === "hoy") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start, end };
  }
  if (period === "semana") {
    // Semana desde el lunes
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
