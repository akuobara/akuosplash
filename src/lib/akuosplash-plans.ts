// Planes de transportista en AkuoSplash
// 3 planes:
//   - gratis:   solo marketplace, panel básico, historial, vehículo, perfil.
//               Comisión 20% ajustable. Sin MP split → el transportista debe
//               emitir y subir sus documentos tributarios para recibir pago.
//   - premium:  casi toda la app. MP split con pago diferido 10 días.
//               Comisión 15% ajustable. Transportista emite sus propios docs SII.
//   - pro:      toda la app + MP split con pago inmediato + Wasabi (facturación
//               automática SII) incluido en el precio del plan. Comisión 10%.
//
// Toda la config es ajustable por el superadmin (persistida en AkuoConfig.planConfigsJson).
// MP usa 2 cuentas: MP_INSTANT (pago inmediato) y MP_10DAY (pago 10 días).
// El plan del transportista determina cuál MP usar para el split del marketplace.
//
// Esta lib expone defaults y helpers para leer/escribir.

import { akuosplashDb } from "./akuosplash-db";

// Alias "pago" → "premium" para backward compatibility (DB existente puede tener plan="pago")
export type PlanId = "gratis" | "pago" | "premium" | "pro";

export type MpSplitMode = "none" | "10day" | "instant";

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
  wasabil: boolean;        // integración Wasabi (facturación SII automática)
  subscripcion: boolean;   // tab de subscripción (ver/mejorar plan)
  docUpload: boolean;      // subir documentos tributarios manualmente (Plan Gratis)
}

export interface PlanConfig {
  id: PlanId;
  nombre: string;
  descripcion: string;
  precioMensual: number;     // CLP
  precioAnual: number;       // CLP (= mensual * 10, 2 meses gratis)
  comisionPct: number;       // % comisión marketplace
  mpSplitMode: MpSplitMode;  // none | 10day | instant
  pagoDiferadoDias: number;  // solo informativo (10 = MP 10day, 0 = instant, N/A si none)
  maxVehiculos: number;     // 0 = ilimitado
  maxChoferes: number;      // 0 = ilimitado
  features: PlanFeatureFlags;
  highlightColor: string;   // tailwind color name for badges/cards
}

export const DEFAULT_PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    descripcion: "Solo marketplace. Comisión 20%. Sin MP split — subís tus documentos tributarios para recibir pago.",
    precioMensual: 0,
    precioAnual: 0,
    comisionPct: 20,
    mpSplitMode: "none",
    pagoDiferadoDias: 0,
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
      docUpload: true,
    },
    highlightColor: "amber",
  },
  pago: {
    // Alias backward-compat: tratamos "pago" igual que "premium" en la DB existente
    id: "pago",
    nombre: "Premium",
    descripcion: "MP split con pago 10 días. Comisión 15%. Emitís tus propios documentos tributarios.",
    precioMensual: 15000,
    precioAnual: 150000,
    comisionPct: 15,
    mpSplitMode: "10day",
    pagoDiferadoDias: 10,
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
      docUpload: false,
    },
    highlightColor: "blue",
  },
  premium: {
    // Mismo que "pago" — registro canónico
    id: "premium",
    nombre: "Premium",
    descripcion: "MP split con pago 10 días. Comisión 15%. Emitís tus propios documentos tributarios.",
    precioMensual: 15000,
    precioAnual: 150000,
    comisionPct: 15,
    mpSplitMode: "10day",
    pagoDiferadoDias: 10,
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
      docUpload: false,
    },
    highlightColor: "blue",
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "MP split con pago inmediato + Wasabi (facturación automática SII incluida). Comisión 10%.",
    precioMensual: 50000,
    precioAnual: 500000,
    comisionPct: 10,
    mpSplitMode: "instant",
    pagoDiferadoDias: 0,
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
      docUpload: false,
    },
    highlightColor: "violet",
  },
};

export const PLAN_ORDER: PlanId[] = ["gratis", "premium", "pro"];

// Normaliza cualquier planId (incluyendo alias "pago" legacy) → PlanId canónico
export function normalizePlanId(raw: string | null | undefined): PlanId {
  if (!raw) return "gratis";
  if (raw === "pago") return "premium"; // alias legacy
  if (raw === "premium" || raw === "gratis" || raw === "pro") return raw;
  return "gratis";
}

// Devuelve la config del plan canónico para un id dado (resolviendo alias)
export function getConfigForPlanId(planId: PlanId): PlanConfig {
  const canonical = planId === "pago" ? "premium" : planId;
  return DEFAULT_PLAN_CONFIGS[canonical] || DEFAULT_PLAN_CONFIGS.gratis;
}

// Lee la config persistida en DB (con merge sobre defaults)
export async function getPlanConfigs(): Promise<Record<PlanId, PlanConfig>> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (!config?.planConfigsJson) {
    // Solo devolver los canónicos (premium + gratis + pro) — "pago" es alias
    return { gratis: DEFAULT_PLAN_CONFIGS.gratis, premium: DEFAULT_PLAN_CONFIGS.premium, pro: DEFAULT_PLAN_CONFIGS.pro, pago: DEFAULT_PLAN_CONFIGS.pago };
  }
  try {
    const parsed = JSON.parse(config.planConfigsJson);
    const result: Record<PlanId, PlanConfig> = {
      gratis: { ...DEFAULT_PLAN_CONFIGS.gratis, ...parsed.gratis, features: { ...DEFAULT_PLAN_CONFIGS.gratis.features, ...(parsed.gratis?.features || {}) } },
      premium: { ...DEFAULT_PLAN_CONFIGS.premium, ...parsed.premium, features: { ...DEFAULT_PLAN_CONFIGS.premium.features, ...(parsed.premium?.features || {}) } },
      pro: { ...DEFAULT_PLAN_CONFIGS.pro, ...parsed.pro, features: { ...DEFAULT_PLAN_CONFIGS.pro.features, ...(parsed.pro?.features || {}) } },
      pago: { ...DEFAULT_PLAN_CONFIGS.pago, ...parsed.pago, features: { ...DEFAULT_PLAN_CONFIGS.pago.features, ...(parsed.pago?.features || {}) } },
    };
    return result;
  } catch {
    return {
      gratis: DEFAULT_PLAN_CONFIGS.gratis,
      premium: DEFAULT_PLAN_CONFIGS.premium,
      pro: DEFAULT_PLAN_CONFIGS.pro,
      pago: DEFAULT_PLAN_CONFIGS.pago,
    };
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
  planId: PlanId;            // canónico: gratis | premium | pro (nunca "pago")
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
  let planId: PlanId = normalizePlanId(u?.plan);
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
    plan: configs[planId] || configs.gratis,
    planActivoDesde: u?.planActivoDesde || null,
    planActivoHasta: planActivoHasta,
    estaActivo,
  };
}

// Devuelve la config de MP según el mpSplitMode del plan
export type MpAccountKind = "instant" | "10day";

export async function getMpCredsForSplitMode(mode: MpSplitMode): Promise<{
  accessToken: string | null;
  publicKey: string | null;
  userId: string | null;
  accountKind: MpAccountKind | null;
}> {
  const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  if (mode === "none") return { accessToken: null, publicKey: null, userId: null, accountKind: null };
  const kind: MpAccountKind = mode === "instant" ? "instant" : "10day";
  if (kind === "instant") {
    return {
      accessToken: config?.mpInstantAccessToken || process.env.AKUO_MP_INSTANT_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || null,
      publicKey: config?.mpInstantPublicKey || process.env.AKUO_MP_INSTANT_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || null,
      userId: config?.mpInstantUserId || process.env.AKUO_MP_INSTANT_USER_ID || process.env.AKUO_MP_USER_ID || null,
      accountKind: kind,
    };
  } else {
    return {
      accessToken: config?.mp10dayAccessToken || process.env.AKUO_MP_10DAY_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || null,
      publicKey: config?.mp10dayPublicKey || process.env.AKUO_MP_10DAY_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || null,
      userId: config?.mp10dayUserId || process.env.AKUO_MP_10DAY_USER_ID || process.env.AKUO_MP_USER_ID || null,
      accountKind: kind,
    };
  }
}
