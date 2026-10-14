// Planes de transportista en AkuoSplash
// 3 planes:
//   - gratis: solo marketplace, panel básico, historial, vehículo, perfil.
//             Comisión más alta, pago diferido 10+ días (MP retiene).
//   - pago:   casi toda la app, comisión reducida, pago más rápido.
//   - pro:    todo + MP para propios clientes + Wasabi (facturación), comisión aún más baja.
//
// Toda la config es ajustable por el superadmin (persistida en AkuoConfig.planConfigsJson).
// Esta lib expone defaults y helpers para leer/escribir.

import { akuosplashDb } from "./akuosplash-db";

export type PlanId = "gratis" | "pago" | "pro";

export interface PlanFeatureFlags {
  dashboard: boolean;       // panel básico (resumen, métricas)
  historial: boolean;      // historial de vueltas
  vehiculo: boolean;       // gestión de camiones
  perfil: boolean;         // perfil del transportista
  entregas: boolean;       // entregas / vueltas activas
  gastos: boolean;         // gastos operativos
  liquidacion: boolean;    // liquidación
  clientes: boolean;       // gestión de clientes propios
  recurrentes: boolean;    // pedidos recurrentes
  equipo: boolean;          // choferes / equipo
  mpPropio: boolean;       // MP para sus propios clientes (Plan Pro)
  wasabil: boolean;        // integración Wasabi (facturación SII)
  subscripcion: boolean;   // tab de subscripción (ver/mejorar plan)
}

export interface PlanConfig {
  id: PlanId;
  nombre: string;
  descripcion: string;
  precioMensual: number;     // CLP
  precioAnual: number;       // CLP (= mensual * 10, 2 meses gratis)
  comisionPct: number;       // % comisión marketplace
  pagoDiferadoDias: number;  // días de retención MP antes de liberar fondos
  maxVehiculos: number;     // 0 = ilimitado
  maxChoferes: number;      // 0 = ilimitado
  features: PlanFeatureFlags;
  highlightColor: string;   // tailwind color name for badges/cards
}

export const DEFAULT_PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    descripcion: "Acceso mínimo al marketplace. Comisión más alta y pago diferido.",
    precioMensual: 0,
    precioAnual: 0,
    comisionPct: 15,
    pagoDiferadoDias: 10,
    maxVehiculos: 1,
    maxChoferes: 1,
    features: {
      dashboard: true,
      historial: true,
      vehiculo: true,
      perfil: true,
      entregas: false,
      gastos: false,
      liquidacion: false,
      clientes: false,
      recurrentes: false,
      equipo: false,
      mpPropio: false,
      wasabil: false,
      subscripcion: true,
    },
    highlightColor: "amber",
  },
  pago: {
    id: "pago",
    nombre: "Pago",
    descripcion: "Casi toda la app. Comisión reducida y pago más rápido.",
    precioMensual: 15000,
    precioAnual: 150000, // 2 meses gratis
    comisionPct: 8,
    pagoDiferadoDias: 3,
    maxVehiculos: 5,
    maxChoferes: 3,
    features: {
      dashboard: true,
      historial: true,
      vehiculo: true,
      perfil: true,
      entregas: true,
      gastos: true,
      liquidacion: true,
      clientes: true,
      recurrentes: true,
      equipo: true,
      mpPropio: false,
      wasabil: false,
      subscripcion: true,
    },
    highlightColor: "blue",
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "Todo + MercadoPago para propios clientes + Wasabi. Comisión mínima.",
    precioMensual: 50000,
    precioAnual: 500000,
    comisionPct: 4,
    pagoDiferadoDias: 1,
    maxVehiculos: 0, // ilimitado
    maxChoferes: 0,
    features: {
      dashboard: true,
      historial: true,
      vehiculo: true,
      perfil: true,
      entregas: true,
      gastos: true,
      liquidacion: true,
      clientes: true,
      recurrentes: true,
      equipo: true,
      mpPropio: true,
      wasabil: true,
      subscripcion: true,
    },
    highlightColor: "violet",
  },
};

export const PLAN_ORDER: PlanId[] = ["gratis", "pago", "pro"];

// Lee la config persistida en DB (con merge sobre defaults)
export async function getPlanConfigs(): Promise<Record<PlanId, PlanConfig>> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config?.planConfigsJson) return { ...DEFAULT_PLAN_CONFIGS };
  try {
    const parsed = JSON.parse(config.planConfigsJson);
    // Merge defaults + saved (por si falta algún campo nuevo)
    const result = { ...DEFAULT_PLAN_CONFIGS };
    for (const k of PLAN_ORDER) {
      const saved = parsed[k];
      if (saved) {
        result[k] = {
          ...DEFAULT_PLAN_CONFIGS[k],
          ...saved,
          features: { ...DEFAULT_PLAN_CONFIGS[k].features, ...(saved.features || {}) },
        };
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_PLAN_CONFIGS };
  }
}

export async function savePlanConfigs(configs: Record<PlanId, PlanConfig>): Promise<void> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config) {
    await akuosplashDb.akuoConfig.create({
      data: { activo: true, planConfigsJson: JSON.stringify(configs) },
    });
  } else {
    await akuosplashDb.akuoConfig.update({
      where: { id: config.id },
      data: { planConfigsJson: JSON.stringify(configs) },
    });
  }
}

// Devuelve la config del plan activo del usuario + flags + plan activo
export async function getPlanActivo(userId: string): Promise<{
  planId: PlanId;
  plan: PlanConfig;
  planActivoDesde: Date | null;
  planActivoHasta: Date | null;
  estaActivo: boolean;
}> {
  const u = await akuosplashDb.akuoUsuario.findUnique({
    where: { id: userId },
    select: { plan: true, planActivoDesde: true, planActivoHasta: true },
  });
  const configs = await getPlanConfigs();
  let planId: PlanId = (u?.plan as PlanId) || "gratis";
  if (!PLAN_ORDER.includes(planId)) planId = "gratis";
  const planActivoHasta = u?.planActivoHasta || null;
  const ahora = new Date();
  const estaActivo = planId !== "gratis" && planActivoHasta ? planActivoHasta > ahora : planId === "gratis";
  // Si plan vencido, efectivamente es "gratis"
  if (!estaActivo && planId !== "gratis") {
    return {
      planId: "gratis",
      plan: configs.gratis,
      planActivoDesde: u?.planActivoDesde || null,
      planActivoHasta: planActivoHasta,
      estaActivo: false,
    };
  }
  return {
    planId,
    plan: configs[planId],
    planActivoDesde: u?.planActivoDesde || null,
    planActivoHasta: planActivoHasta,
    estaActivo,
  };
}
