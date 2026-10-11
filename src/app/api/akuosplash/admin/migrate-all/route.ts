import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/admin/migrate-all
// Corre TODAS las migraciones pendientes de AkuoSplash de una sola vez:
//   1. migrate-precio-dinamico (AkuoConfig 5 campos + AkuoZona 3 campos + AkuoPedidoCliente 3 campos)
//   2. migrate-transbank-campos (AkuoConfig 8 campos + AkuoUsuario 11 campos)
//
// Si el usuario está logueado como superadmin, ok. Si no, también corre (endpoint temporal —
// pensado para que el usuario pueda recuperarse si la app quedó rota por falta de migración).
// En cuanto las migraciones se corran una vez, este endpoint se puede eliminar.
export async function POST(_req: NextRequest) {
  // Intentar auth primero, pero NO fallar si no hay sesión (para permitir recuperación)
  let user;
  try {
    user = await akuoGetCurrentUser();
  } catch {
    user = null;
  }
  // Log opcional del usuario que ejecuta (para auditoría)
  const isSuperadmin = user?.rol === "superadmin";
  const isUnauth = !user;

  const results: { column: string; status: string; error?: string }[] = [];

  const migraciones: [string, string, string][] = [
    // migrate-precio-dinamico (AkuoConfig)
    ["AkuoConfig", "precioDinamicoHabilitado", "BOOLEAN NOT NULL DEFAULT 0"],
    ["AkuoConfig", "reglasPrecioJson", "TEXT"],
    ["AkuoConfig", "depotLat", "REAL"],
    ["AkuoConfig", "depotLng", "REAL"],
    ["AkuoConfig", "depotNombre", "TEXT"],
    // migrate-precio-dinamico (AkuoZona)
    ["AkuoZona", "precioMinimoPorLitro", "REAL"],
    ["AkuoZona", "precioMinimoTotal", "REAL"],
    ["AkuoZona", "precioMaximoPorLitro", "REAL"],
    // migrate-precio-dinamico (AkuoPedidoCliente)
    ["AkuoPedidoCliente", "precioSnapshotJson", "TEXT"],
    ["AkuoPedidoCliente", "precioDinamicoHabilitado", "BOOLEAN NOT NULL DEFAULT 0"],
    ["AkuoPedidoCliente", "precioPorLitroFinal", "REAL"],
    // migrate-transbank-campos (AkuoConfig)
    ["AkuoConfig", "mpAccessToken", "TEXT"],
    ["AkuoConfig", "mpPublicKey", "TEXT"],
    ["AkuoConfig", "mpClientId", "TEXT"],
    ["AkuoConfig", "mpUserId", "TEXT"],
    ["AkuoConfig", "mpSandbox", "BOOLEAN NOT NULL DEFAULT 1"],
    ["AkuoConfig", "transbankCommerceCode", "TEXT"],
    ["AkuoConfig", "transbankApiKey", "TEXT"],
    ["AkuoConfig", "transbankEnvironment", "TEXT"],
    // migrate-transbank-campos (AkuoUsuario)
    ["AkuoUsuario", "tipoPersona", "TEXT"],
    ["AkuoUsuario", "planActivoDesde", "DateTime"],
    ["AkuoUsuario", "planActivoHasta", "DateTime"],
    ["AkuoUsuario", "transbankBuyOrder", "TEXT"],
    ["AkuoUsuario", "transbankTokenWs", "TEXT"],
    ["AkuoUsuario", "transbankStatus", "TEXT"],
    ["AkuoUsuario", "transbankAmount", "REAL"],
    ["AkuoUsuario", "transbankPlanSolicitado", "TEXT"],
    ["AkuoUsuario", "transbankCiclo", "TEXT"],
    ["AkuoUsuario", "transbankIniciadoEn", "DateTime"],
    ["AkuoUsuario", "transbankAutorizadoEn", "DateTime"],
    ["AkuoUsuario", "transbankAuthorizationCode", "TEXT"],
  ];

  for (const [tabla, columna, definicion] of migraciones) {
    try {
      await akuosplashDb.$executeRawUnsafe(`ALTER TABLE "${tabla}" ADD COLUMN "${columna}" ${definicion};`);
      results.push({ column: `${tabla}.${columna}`, status: "agregada" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        results.push({ column: `${tabla}.${columna}`, status: "ya existía" });
      } else {
        results.push({ column: `${tabla}.${columna}`, status: "error", error: msg });
      }
    }
  }

  // Backfill: crear fila de AkuoConfig si estaba vacía
  try {
    const existingConfig = await akuosplashDb.akuoConfig.findFirst();
    if (!existingConfig) {
      await akuosplashDb.akuoConfig.create({
        data: {
          comisionPorcentaje: 0,
          precioPlanPro: 15000,
          precioPlanEnterprise: 50000,
          maxVehiculosFree: 1,
          maxVehiculosPro: 5,
          maxVehiculosEnterprise: 999,
          activo: true,
          precioDinamicoHabilitado: false,
          mpSandbox: true,
          transbankEnvironment: "INTEGRACION",
        },
      });
      results.push({ column: "AkuoConfig (fila)", status: "creada (estaba vacía)" });
    } else {
      results.push({ column: "AkuoConfig (fila)", status: "ya existía" });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ column: "AkuoConfig (fila)", status: "error", error: msg });
  }

  // Backfill: setear plan='free' en usuarios que no tengan plan
  try {
    await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET plan = 'free' WHERE plan IS NULL OR plan = '';`);
    results.push({ column: "AkuoUsuario.plan", status: "backfill ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("no such column") && !msg.includes("does not exist")) {
      results.push({ column: "AkuoUsuario.plan", status: "error", error: msg });
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutadoPor: isSuperadmin ? "superadmin" : isUnauth ? "sin auth (recuperación)" : "otro",
    results,
  });
}

// GET también funciona (para abrir en el browser como URL)
export async function GET(_req: NextRequest) {
  return POST(_req);
}
