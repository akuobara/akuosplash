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
  precioSemanal?: number;    // CLP
  precioDiario?: number;     // CLP
  ciclosDisponibles?: string[]; // ["diario", "semanal", "mensual", "anual"]
  comisionPct: number;       // % comisión marketplace
  mpSplitMode: MpSplitMode;  // none | 10day | instant
  pagoDiferadoDias: number;  // solo informativo (10 = MP 10day, 0 = instant, N/A si none)
  maxVehiculos: number;     // 0 = ilimitado
  maxChoferes: number;      // 0 = ilimitado
  activa: boolean;          // si el plan está disponible para nuevos subscripciones
  features: PlanFeatureFlags;
  highlightColor: string;   // tailwind color name for badges/cards
}

// RESTAURADO a los valores reales del producto (15/12.5/8.5% SIN MP split)
export const DEFAULT_PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  gratis: {
    id: "gratis",
    nombre: "Gratis",
    descripcion: "Sin MP split — el transportista emite y sube sus documentos tributarios para recibir pago. Comisión marketplace 15%.",
    precioMensual: 0,
    precioAnual: 0,
    comisionPct: 15,
    mpSplitMode: "none",
    pagoDiferadoDias: 0,
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
    id: "pago",
    nombre: "Premium",
    descripcion: "Sin MP split. Comisión marketplace 12.5%. Herramientas de productividad intermedias.",
    precioMensual: 7990,
    precioAnual: 79900,
    comisionPct: 12.5,
    mpSplitMode: "none",
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
    id: "premium",
    nombre: "Premium",
    descripcion: "Sin MP split. Comisión marketplace 12.5%. Herramientas de productividad intermedias.",
    precioMensual: 7990,
    precioAnual: 79900,
    comisionPct: 12.5,
    mpSplitMode: "none",
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
    descripcion: "Sin MP split. Comisión marketplace 8.5%. Todas las herramientas de productividad + gestión de camiones, liquidación y equipo.",
    precioMensual: 23990,
    precioAnual: 239900,
    comisionPct: 8.5,
    mpSplitMode: "none",
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

// Migración automática: sobreescribe los 3 planes base con los defaults correctos
// la primera vez que se carga la app después de un deploy con nuevos defaults.
// Usa un version flag en AkuoConfig para que solo corra cuando cambian los defaults.
let _planDefaultsChecked = false;
const PLAN_DEFAULTS_VERSION = "2026-11-11-v1"; // <- cambiar cuando cambien los defaults

async function ensurePlanDefaults(): Promise<void> {
  if (_planDefaultsChecked) return;
  _planDefaultsChecked = true;

  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    // Asegurar que la columna planDefaultsVersion exista
    await client.execute("ALTER TABLE AkuoConfig ADD COLUMN planDefaultsVersion TEXT").catch(() => {});

    // Leer la versión guardada
    let storedVersion: string | null = null;
    try {
      const r = await client.execute("SELECT planDefaultsVersion FROM AkuoConfig WHERE activo = 1 LIMIT 1");
      if (r.rows.length > 0) {
        storedVersion = (r.rows[0] as any).planDefaultsVersion || null;
      }
    } catch {}

    // Si la versión coincide, no hacer nada
    if (storedVersion === PLAN_DEFAULTS_VERSION) {
      console.log("[ensurePlanDefaults] versión OK, sin migración");
      return;
    }

    // Version distinta o null → sobreescribir los 3 planes base con defaults
    console.log(`[ensurePlanDefaults] migrando de "${storedVersion}" → "${PLAN_DEFAULTS_VERSION}"`);
    await savePlanConfigs({
      gratis: DEFAULT_PLAN_CONFIGS.gratis,
      premium: DEFAULT_PLAN_CONFIGS.premium,
      pro: DEFAULT_PLAN_CONFIGS.pro,
    });

    // Guardar la nueva versión
    try {
      await client.execute({
        sql: "UPDATE AkuoConfig SET planDefaultsVersion = ? WHERE activo = 1",
        args: [PLAN_DEFAULTS_VERSION],
      });
    } catch (e: any) {
      console.warn("[ensurePlanDefaults] no se pudo guardar version flag:", e?.message);
    }

    console.log("[ensurePlanDefaults] migración completa");
  } catch (e: any) {
    console.warn("[ensurePlanDefaults] error:", e?.message);
  }
}

// Lee la config persistida en DB — respeta EXACTAMENTE lo guardado en AkuoPlanConfig
// NO mergea defaults sobre los features guardados (eso era lo que hacia que se pierdan
// las funcionalidades que el usuario desactivó o activó manualmente).
export async function getPlanConfigs(): Promise<Record<string, PlanConfig>> {
  // Migración automática (solo corre una vez por proceso, cuando cambia la versión)
  await ensurePlanDefaults();

  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const r = await client.execute("SELECT * FROM AkuoPlanConfig ORDER BY orden ASC");
    if (r.rows.length > 0) {
      const configs: Record<string, PlanConfig> = {};
      for (const row of r.rows) {
        const p = row as any;
        // Features: usar EXACTAMENTE lo guardado en la DB. Solo si está vacío usar defaults.
        let features = (() => { try { return JSON.parse(p.features || '{}'); } catch { return {}; } })();
        if (!features || Object.keys(features).length === 0) {
          const defaultCfg = (DEFAULT_PLAN_CONFIGS as any)[p.id];
          if (defaultCfg) features = { ...defaultCfg.features };
        }
        const ciclosDefault = (p.precioDiario && p.precioDiario > 0) ? ["diario"] :
                              (p.precioSemanal && p.precioSemanal > 0) ? ["semanal"] :
                              (p.precioAnual && p.precioAnual > 0) ? ["mensual","anual"] : ["mensual"];

        // PARA LOS 3 PLANES BASE: forzar comisionPct y mpSplitMode a los defaults del producto.
        // La DB puede tener valores viejos incorrectos (split en vez de none, comisiones mal).
        // Los planes custom (test, etc.) usan los valores de la DB tal cual.
        const isBasePlan = p.id === "gratis" || p.id === "premium" || p.id === "pro" || p.id === "pago";
        const defaultCfgForBase = (DEFAULT_PLAN_CONFIGS as any)[p.id];
        const forcedComisionPct = isBasePlan && defaultCfgForBase ? defaultCfgForBase.comisionPct : (Number(p.comisionPct) || 0);
        const forcedMpSplitMode = isBasePlan && defaultCfgForBase ? defaultCfgForBase.mpSplitMode : (p.mpSplitMode || "none");

        configs[p.id] = {
          id: p.id,
          nombre: isBasePlan && defaultCfgForBase ? defaultCfgForBase.nombre : p.nombre,
          descripcion: p.descripcion || (defaultCfgForBase?.descripcion || ""),
          orden: p.orden,
          activa: !!p.activo,
          precioMensual: Number(p.precioMensual) || 0,
          precioAnual: Number(p.precioAnual) || 0,
          precioSemanal: Number(p.precioSemanal) || 0,
          precioDiario: Number(p.precioDiario) || 0,
          ciclosDisponibles: (() => {
            try {
              const parsed = JSON.parse(p.ciclosDisponibles || 'null');
              if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            } catch {}
            return ciclosDefault;
          })(),
          comisionPct: forcedComisionPct,
          vehiculosPermitidos: Number(p.vehiculosPermitidos) || 1,
          choferesPermitidos: Number(p.choferesPermitidos) || 1,
          maxVehiculos: Number(p.vehiculosPermitidos) || 1,
          maxChoferes: Number(p.choferesPermitidos) || 1,
          mpSplitMode: forcedMpSplitMode as MpSplitMode,
          feeManualFijo: Number(p.feeManualFijo) || 3290,
          feeManualPct: Number(p.feeManualPct) || 1.7,
          pagoDiferadoDias: forcedMpSplitMode === "10day" ? 10 : 0,
          highlightColor: (DEFAULT_PLAN_CONFIGS as any)[p.id]?.highlightColor || "blue",
          features,
        } as any;
      }
      // Asegurar que los 3 planes base existan (si por algún motivo no están en la DB)
      if (!configs.gratis) configs.gratis = DEFAULT_PLAN_CONFIGS.gratis;
      if (!configs.premium) configs.premium = DEFAULT_PLAN_CONFIGS.premium;
      if (!configs.pro) configs.pro = DEFAULT_PLAN_CONFIGS.pro;
      return configs;
    }
  } catch (e: any) {
    console.warn("[getPlanConfigs] AkuoPlanConfig failed:", e?.message);
  }

  // Fallback a defaults
  return {
    gratis: DEFAULT_PLAN_CONFIGS.gratis,
    premium: DEFAULT_PLAN_CONFIGS.premium,
    pro: DEFAULT_PLAN_CONFIGS.pro,
    pago: DEFAULT_PLAN_CONFIGS.pago,
  };
}

// Guarda la config en AkuoPlanConfig (libsql directo — Prisma falla en Render).
// UPSERT por id: si el plan ya existe, UPDATE; si no, INSERT.
// Esto reemplaza el viejo savePlanConfigs que escribía a AkuoConfig.planConfigsJson
// (lo cual nunca se reflejaba en la tabla nueva AkuoPlanConfig que lee getPlanConfigs).
export async function savePlanConfigs(configs: Record<string, PlanConfig>): Promise<void> {
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  // Asegurar que la tabla existe (idempotente)
  await client.execute(
    `CREATE TABLE IF NOT EXISTS AkuoPlanConfig (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      orden INTEGER DEFAULT 99,
      activo INTEGER DEFAULT 1,
      precioMensual REAL DEFAULT 0,
      precioAnual REAL DEFAULT 0,
      precioSemanal REAL DEFAULT 0,
      precioDiario REAL DEFAULT 0,
      comisionPct REAL DEFAULT 15,
      vehiculosPermitidos INTEGER DEFAULT 1,
      choferesPermitidos INTEGER DEFAULT 1,
      mpSplitMode TEXT DEFAULT 'split',
      ciclosDisponibles TEXT,
      feeManualFijo REAL DEFAULT 3290,
      feeManualPct REAL DEFAULT 1.7,
      features TEXT,
      creadoEn TEXT NOT NULL,
      actualizadoEn TEXT NOT NULL
    )`
  ).catch(() => {});

  const ahora = new Date().toISOString();
  let ordenIdx = 0;
  for (const [id, plan] of Object.entries(configs)) {
    // Sincronizar alias "pago" con "premium" — no duplicar
    if (id === "pago") continue;
    const featuresJson = JSON.stringify(plan.features || {});
    const ciclosJson = JSON.stringify(plan.ciclosDisponibles ||
      (plan.precioDiario && plan.precioDiario > 0 ? ["diario"] :
       plan.precioSemanal && plan.precioSemanal > 0 ? ["semanal"] :
       plan.precioAnual && plan.precioAnual > 0 ? ["mensual","anual"] : ["mensual"]));
    const activo = plan.activa === false ? 0 : 1;

    try {
      const existing = await client.execute({ sql: "SELECT id FROM AkuoPlanConfig WHERE id = ?", args: [id] });
      if (existing.rows.length > 0) {
        await client.execute({
          sql: `UPDATE AkuoPlanConfig SET
                  nombre = ?, descripcion = ?, orden = ?, activo = ?,
                  precioMensual = ?, precioAnual = ?, precioSemanal = ?, precioDiario = ?,
                  comisionPct = ?, vehiculosPermitidos = ?, choferesPermitidos = ?,
                  mpSplitMode = ?, ciclosDisponibles = ?, features = ?, actualizadoEn = ?
                WHERE id = ?`,
          args: [
            plan.nombre, plan.descripcion || null, ordenIdx, activo,
            Number(plan.precioMensual) || 0, Number(plan.precioAnual) || 0,
            Number(plan.precioSemanal) || 0, Number(plan.precioDiario) || 0,
            Number(plan.comisionPct) || 0,
            Number(plan.maxVehiculos) || 1, Number(plan.maxChoferes) || 1,
            plan.mpSplitMode || "split", ciclosJson, featuresJson, ahora,
            id,
          ],
        });
      } else {
        await client.execute({
          sql: `INSERT INTO AkuoPlanConfig
                  (id, nombre, descripcion, orden, activo, precioMensual, precioAnual, precioSemanal, precioDiario,
                   comisionPct, vehiculosPermitidos, choferesPermitidos, mpSplitMode, ciclosDisponibles,
                   feeManualFijo, feeManualPct, features, creadoEn, actualizadoEn)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id, plan.nombre, plan.descripcion || null, ordenIdx, activo,
            Number(plan.precioMensual) || 0, Number(plan.precioAnual) || 0,
            Number(plan.precioSemanal) || 0, Number(plan.precioDiario) || 0,
            Number(plan.comisionPct) || 0,
            Number(plan.maxVehiculos) || 1, Number(plan.maxChoferes) || 1,
            plan.mpSplitMode || "split", ciclosJson,
            3290, 1.7, featuresJson, ahora, ahora,
          ],
        });
      }
      ordenIdx++;
    } catch (e: any) {
      console.error(`[savePlanConfigs] error guardando plan ${id}:`, e?.message);
      // no detener el loop — seguir con los demás
    }
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
    // Usar libsql directo (Prisma $queryRawUnsafe falla en Render)
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const result = await client.execute({
      sql: "SELECT plan, planActivoDesde, planActivoHasta FROM AkuoUsuario WHERE id = ? LIMIT 1",
      args: [userId],
    });
    if (result.rows.length > 0) {
      const row = result.rows[0] as any;
      userPlan = row.plan || null;
      userPlanActivoDesde = row.planActivoDesde ? new Date(row.planActivoDesde) : null;
      userPlanActivoHasta = row.planActivoHasta ? new Date(row.planActivoHasta) : null;
    }
  } catch {
    // Si falla, usar defaults
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
