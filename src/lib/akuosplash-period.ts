// Helper para calcular rangos de fechas por período
// (mismo comportamiento que Aljibe)
export function getPeriodRange(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case "hoy": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "ayer": {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const endAyer = new Date(start);
      endAyer.setHours(23, 59, 59, 999);
      return { start, end: endAyer };
    }
    case "semana": {
      // Domingo a sábado (semana chilena)
      const start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "semana7": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "mes": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "mes_anterior": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      const endMes = new Date(now.getFullYear(), now.getMonth(), 0);
      endMes.setHours(23, 59, 59, 999);
      return { start, end: endMes };
    }
    case "mes3": {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "todo":
    default: {
      const start = new Date(0);
      return { start, end };
    }
  }
}

export const PERIODS: { value: string; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Esta semana (Dom-Sáb)" },
  { value: "semana7", label: "Últimos 7 días" },
  { value: "mes", label: "Este mes" },
  { value: "mes_anterior", label: "Mes anterior" },
  { value: "mes3", label: "Últimos 3 meses" },
  { value: "todo", label: "Todo" },
];
