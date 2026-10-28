// Planes de transportista en AkuoSplash
// 3 planes:
//   - gratis:   solo marketplace, panel básico, historial, vehículo, perfil.
//               Comisión 20% ajustable. Sin MP split → el transportista debe
//               emitir y subir sus documentos tributarios para recibir pago.
//   - premium:  casi toda la app. MP split con pago diferido 10 días.
//               Comisión 15% ajustable. Transportista emite sus propios docs SII.
//   - pro:      toda la app + MP split con pago inmediato + Wasabil (plan Growth
//               de wasabil.cl, facturación automática SII) incluido en el precio. Comisión 10%.
//
// Toda la config es ajustable por el superadmin (persistida en AkuoConfig.planConfigsJson).
// MP usa 2 cuentas: MP_INSTANT (pago inmediato) y MP_10DAY (pago 10 días).
// El plan del transportista determina cuál MP usar para el split del marketplace.
//
// Esta lib expone defaults y helpers para leer/escribir.

import { akuosplashDb } from "./akuosplash-db";

// Alias "pago" → "premium" para backward compatibility (DB existente puede tener plan="pago")
export type PlanId = "gratis" | "pago" | "premium" | "pro";

export type MpSplitMode = "none" | "10day" | "instant" | "split";

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
  wasabil: boolean;        // integración Wasabil (plan Growth de wasabil.cl, facturación SII automática)
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
  activa: boolean;          // si el plan está disponible para nuevos subscripciones
  features: PlanFeatureFlags;
  highlightColor: string;   // tailwind color name for badges/cards
}

export const DEFAULT_PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    descripcion: "MercadoPago Split (pago a 10 días). Comisión marketplace 17.5%. Panel básico de productividad.",
    precioMensual: 0,
    precioAnual: 0,
    comisionPct: 17.5,
    mpSplitMode: "split",
    pagoDiferadoDias: 10,
    maxVehiculos: 1,
    maxChoferes: 1,
    features: {
      dashboard: true,
      historial: false,
      vehiculo: false,
      perfil: true,
      entregas: true,
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
    activa: true,
    highlightColor: "amber",
  },
  pago: {
    // Alias backward-compat: tratamos "pago" igual que "premium" en la DB existente
    id: "pago",
    nombre: "Premium",
    descripcion: "MercadoPago Split (pago instantáneo). Comisión marketplace 12.5%. Herramientas de productividad intermedias.",
    precioMensual: 7990,
    precioAnual: 0,
    comisionPct: 12.5,
    mpSplitMode: "split",
    pagoDiferadoDias: 0,
    maxVehiculos: 1,
    maxChoferes: 1,
    features: {
      dashboard: true,
      historial: true,
      vehiculo: false,
      perfil: true,
      entregas: true,
      gastos: true,
      liquidacion: false,
      clientes: true,
      recurrentes: true,
      equipo: false,
      mpPropio: false,
      wasabil: false,
      subscripcion: true,
      docUpload: false,
    },
    activa: true,
    highlightColor: "blue",
  },
  premium: {
    // Mismo que "pago" — registro canónico
    id: "premium",
    nombre: "Premium",
    descripcion: "MercadoPago Split (pago instantáneo). Comisión marketplace 12.5%. Herramientas de productividad intermedias.",
    precioMensual: 7990,
    precioAnual: 0,
    comisionPct: 12.5,
    mpSplitMode: "split",
    pagoDiferadoDias: 0,
    maxVehiculos: 1,
    maxChoferes: 1,
    features: {
      dashboard: true,
      historial: true,
      vehiculo: false,
      perfil: true,
      entregas: true,
      gastos: true,
      liquidacion: false,
      clientes: true,
      recurrentes: true,
      equipo: false,
      mpPropio: false,
      wasabil: false,
      subscripcion: true,
      docUpload: false,
    },
    activa: true,
    highlightColor: "blue",
  },
  pro: {
    id: "pro",
    nombre: "Pro",
    descripcion: "MercadoPago Split (pago instantáneo). Comisión marketplace 8.5%. Todas las herramientas de productividad + gestión de camiones, liquidación y equipo.",
    precioMensual: 23990,
    precioAnual: 0,
    comisionPct: 8.5,
    mpSplitMode: "split",
    pagoDiferadoDias: 0,
    maxVehiculos: 5,
    maxChoferes: 5,
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
    activa: true,
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

// Auto-migración defensiva: si las columnas nuevas no existen, las crea.
// Esto permite que la app funcione aunque el superadmin no haya corrido la migración manualmente.
let _autoMigrated = false;
export async function ensureAkuoConfigColumns() {
  if (_autoMigrated) return;
  _autoMigrated = true;
  const statements = [
    "ALTER TABLE AkuoConfig ADD COLUMN planConfigsJson TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpInstantAccessToken TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpInstantPublicKey TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpInstantUserId TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mp10dayAccessToken TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mp10dayPublicKey TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mp10dayUserId TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpSplitAccessToken TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpSplitPublicKey TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpSplitUserId TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpSubAccessToken TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpSubPublicKey TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubPreapprovalId TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubPlanSolicitado TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubCiclo TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubStatus TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubIniciadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubAutorizadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubAmount REAL",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpTestUserEmail TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubSuspended INTEGER DEFAULT 0",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubSuspendedEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubSuspendedPor TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubSuspendedRazon TEXT",
    "ALTER TABLE AkuoZona ADD COLUMN comunaCode TEXT",
    "ALTER TABLE AkuoZona ADD COLUMN codRegion INTEGER",
    "ALTER TABLE AkuoZona ADD COLUMN parentZonaId TEXT",
    "ALTER TABLE AkuoZona ADD COLUMN sector TEXT",
    "ALTER TABLE AkuoZona ADD COLUMN tipoSector TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN legalPagesJson TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioUrl TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioFolio TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioSubidoEn DATETIME",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioSubidoPor TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioMonto REAL",
    // Estado de aprobación del transportista (para superadmin)
    // valores: pendiente (default) | pre_aprobado | aprobado | rechazado
    "ALTER TABLE AkuoUsuario ADD COLUMN estadoAprobacion TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN estadoAprobacionNota TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN estadoAprobacionActualizadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN estadoAprobacionActualizadoPor TEXT",
  ];
  // Las tablas nuevas (AkuoCupon, AkuoUsuarioCupon) se crean con CREATE TABLE IF NOT EXISTS
  const createStatements = [
    `CREATE TABLE IF NOT EXISTS AkuoCupon (
      id TEXT PRIMARY KEY,
      creadoEn TEXT NOT NULL,
      actualizadoEn TEXT NOT NULL,
      codigo TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      descuentoTipo TEXT NOT NULL,
      descuentoValor REAL NOT NULL,
      minMonto REAL,
      planIdAplicable TEXT,
      maxUsos INTEGER NOT NULL DEFAULT 0,
      usos INTEGER NOT NULL DEFAULT 0,
      fechaInicio TEXT NOT NULL,
      fechaFin TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creadoPor TEXT,
      nota TEXT,
      descripcionPublica TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS AkuoUsuarioCupon (
      id TEXT PRIMARY KEY,
      usadoEn TEXT NOT NULL,
      cuponId TEXT NOT NULL,
      usuarioId TEXT NOT NULL,
      pedidoClienteId TEXT,
      planActivado TEXT,
      montoAhorrado REAL NOT NULL,
      FOREIGN KEY (cuponId) REFERENCES AkuoCupon(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_AkuoCupon_tipo_activo ON AkuoCupon(tipo, activo)`,
    `CREATE INDEX IF NOT EXISTS idx_AkuoCupon_fechas ON AkuoCupon(fechaInicio, fechaFin)`,
    `CREATE INDEX IF NOT EXISTS idx_AkuoUsuarioCupon_cupon_usuario ON AkuoUsuarioCupon(cuponId, usuarioId)`,
    `CREATE INDEX IF NOT EXISTS idx_AkuoUsuarioCupon_usuario ON AkuoUsuarioCupon(usuarioId)`,
  ];
  for (const sql of statements) {
    try {
      await akuosplashDb.$executeRawUnsafe(sql);
    } catch (e: any) {
      // "duplicate column" = ya existe, ok
      if (!String(e?.message || "").includes("duplicate column") && !String(e?.message || "").includes("already exists")) {
        // Otro error → log pero no fallar
        console.warn("[auto-migrate]", sql.substring(0, 60), e?.message);
      }
    }
  }
  // Crear tablas nuevas (idempotente via IF NOT EXISTS)
  for (const sql of createStatements) {
    try {
      await akuosplashDb.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.warn("[auto-migrate create]", sql.substring(0, 60), e?.message);
    }
  }
}

// Lee la config persistida en DB (con merge sobre defaults)
// DEFENSIVE: usa raw SQL y auto-migra si las columnas nuevas no existen.
export async function getPlanConfigs(): Promise<Record<PlanId, PlanConfig>> {
  await ensureAkuoConfigColumns();
  let planConfigsJson: string | null = null;
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(`SELECT planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
    if (Array.isArray(result) && result.length > 0) {
      planConfigsJson = result[0]?.planConfigsJson || null;
    }
  } catch (e: any) {
    console.warn("[getPlanConfigs] SQL failed, using defaults:", e?.message);
    planConfigsJson = null;
  }

  if (!planConfigsJson) {
    return {
      gratis: DEFAULT_PLAN_CONFIGS.gratis,
      premium: DEFAULT_PLAN_CONFIGS.premium,
      pro: DEFAULT_PLAN_CONFIGS.pro,
      pago: DEFAULT_PLAN_CONFIGS.pago,
    };
  }

  try {
    const parsed = JSON.parse(planConfigsJson);
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
  await ensureAkuoConfigColumns();
  const json = JSON.stringify(configs);
  // DEFENSIVE: usar raw SQL porque AkuoConfig.findFirst() puede fallar si hay columnas nuevas no migradas
  const existing: any = await akuosplashDb.$queryRawUnsafe(`SELECT id FROM AkuoConfig WHERE activo = 1 LIMIT 1`).catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) {
    const id = existing[0].id;
    const result = await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoConfig SET planConfigsJson = ? WHERE id = ?`, json, id);
    if (result === 0) {
      throw new Error("UPDATE no afectó ninguna fila — verificar que el row existe");
    }
  } else {
    await akuosplashDb.$executeRawUnsafe(
      `INSERT INTO AkuoConfig (id, creadoEn, comisionPorcentaje, activo, planConfigsJson) VALUES (?, ?, 0, 1, ?)`,
      `cfg_${Date.now()}`, new Date().toISOString(), json
    );
  }
}

// Devuelve la config del plan activo del usuario + flags + plan activo
// DEFENSIVE: usa raw SQL para leer solo los campos necesarios
export async function getPlanActivo(userId: string): Promise<{
  planId: PlanId;            // canónico: gratis | premium | pro (nunca "pago")
  plan: PlanConfig;
  planActivoDesde: Date | null;
  planActivoHasta: Date | null;
  estaActivo: boolean;
}> {
  await ensureAkuoConfigColumns();
  let userPlan: string | null = null;
  let userPlanActivoDesde: Date | null = null;
  let userPlanActivoHasta: Date | null = null;
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT plan, planActivoDesde, planActivoHasta FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      userId
    );
    if (Array.isArray(result) && result.length > 0) {
      userPlan = result[0].plan || null;
      userPlanActivoDesde = result[0].planActivoDesde ? new Date(result[0].planActivoDesde) : null;
      userPlanActivoHasta = result[0].planActivoHasta ? new Date(result[0].planActivoHasta) : null;
    }
  } catch {
    // Si falla (columnas no existen), usar defaults
  }

  const configs = await getPlanConfigs();
  let planId: PlanId = normalizePlanId(userPlan);
  const planActivoHasta = userPlanActivoHasta;
  const ahora = new Date();
  const estaActivo = planId !== "gratis" && planActivoHasta ? planActivoHasta > ahora : planId === "gratis";
  // Si plan vencido, efectivamente es "gratis"
  if (!estaActivo && planId !== "gratis") {
    return {
      planId: "gratis",
      plan: configs.gratis,
      planActivoDesde: userPlanActivoDesde,
      planActivoHasta: planActivoHasta,
      estaActivo: false,
    };
  }
  return {
    planId,
    plan: configs[planId] || configs.gratis,
    planActivoDesde: userPlanActivoDesde,
    planActivoHasta: planActivoHasta,
    estaActivo,
  };
}

// Devuelve la config de MP para el SPLIT (cuando el cliente paga por agua en el marketplace).
// Una sola cuenta para todos los planes — la comisión la calcula el backend de AkuoSplash.
// Si mpSplitMode === "none" (Plan Gratis), no se usa MP split → devolver null.
export async function getMpSplitCreds(): Promise<{
  accessToken: string | null;
  publicKey: string | null;
  userId: string | null;
}> {
  await ensureAkuoConfigColumns();
  // 1. Intentar leer de AkuoConfig los campos mpSplit* (los nuevos)
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpSplitAccessToken, mpSplitPublicKey, mpSplitUserId FROM AkuoConfig WHERE activo = 1 LIMIT 1`
    );
    if (Array.isArray(result) && result.length > 0) {
      const row = result[0];
      return {
        accessToken: row.mpSplitAccessToken || process.env.AKUO_MP_SPLIT_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || null,
        publicKey: row.mpSplitPublicKey || process.env.AKUO_MP_SPLIT_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || null,
        userId: row.mpSplitUserId || process.env.AKUO_MP_SPLIT_USER_ID || process.env.AKUO_MP_USER_ID || null,
      };
    }
  } catch (e: any) {
    console.warn("[getMpSplitCreds] SQL failed, using env vars:", e?.message);
  }
  // 2. Fallback a env vars
  return {
    accessToken: process.env.AKUO_MP_SPLIT_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || null,
    publicKey: process.env.AKUO_MP_SPLIT_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || null,
    userId: process.env.AKUO_MP_SPLIT_USER_ID || process.env.AKUO_MP_USER_ID || null,
  };
}

// Devuelve la config de MP para SUBSCRIPTIONS (cuando el transportista paga por su plan).
// Cuenta separada de la de split. Para testing, pueden ser la misma cuenta.
export async function getMpSubCreds(): Promise<{
  accessToken: string | null;
  publicKey: string | null;
}> {
  await ensureAkuoConfigColumns();
  // 1. Intentar leer de AkuoConfig los campos mpSub* (los nuevos)
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpSubAccessToken, mpSubPublicKey FROM AkuoConfig WHERE activo = 1 LIMIT 1`
    );
    if (Array.isArray(result) && result.length > 0) {
      const row = result[0];
      return {
        accessToken: row.mpSubAccessToken || process.env.AKUO_MP_SUB_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || null,
        publicKey: row.mpSubPublicKey || process.env.AKUO_MP_SUB_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || null,
      };
    }
  } catch (e: any) {
    console.warn("[getMpSubCreds] SQL failed, using env vars:", e?.message);
  }
  // 2. Fallback a env vars
  return {
    accessToken: process.env.AKUO_MP_SUB_ACCESS_TOKEN || process.env.AKUO_MP_ACCESS_TOKEN || null,
    publicKey: process.env.AKUO_MP_SUB_PUBLIC_KEY || process.env.AKUO_MP_PUBLIC_KEY || null,
  };
}

// Legacy: getMpCredsForSplitMode — mantener por compat, pero redirige a getMpSplitCreds.
// El parámetro `mode` ya no afecta qué cuenta se usa (todos los modos no-"none" usan la misma cuenta split).
export type MpAccountKind = "instant" | "10day";

export async function getMpCredsForSplitMode(mode: MpSplitMode): Promise<{
  accessToken: string | null;
  publicKey: string | null;
  userId: string | null;
  accountKind: MpAccountKind | null;
}> {
  if (mode === "none") return { accessToken: null, publicKey: null, userId: null, accountKind: null };
  const creds = await getMpSplitCreds();
  return { ...creds, accountKind: "instant" }; // el accountKind ya no es relevante
}
