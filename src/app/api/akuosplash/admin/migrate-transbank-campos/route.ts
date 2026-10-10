import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// Endpoint TEMPORAL para migrar columnas nuevas (Transbank + credenciales de integraciones).
// Ejecutar una sola vez desde el browser logueado como superadmin.
//
// Migraciones:
// - AkuoConfig: mpAccessToken, mpPublicKey, mpClientId, mpUserId, mpSandbox,
//               transbankCommerceCode, transbankApiKey, transbankEnvironment
// - AkuoUsuario: planActivoDesde, planActivoHasta, transbankBuyOrder, transbankTokenWs,
//                transbankStatus, transbankAmount, transbankPlanSolicitado, transbankCiclo,
//                transbankIniciadoEn, transbankAutorizadoEn, transbankAuthorizationCode
export async function POST(_req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin puede migrar" }, { status: 403 });
  }

  const results: { column: string; status: string; error?: string }[] = [];

  const migraciones: [string, string, string][] = [
    // AkuoConfig
    ["AkuoConfig", "mpAccessToken", "TEXT"],
    ["AkuoConfig", "mpPublicKey", "TEXT"],
    ["AkuoConfig", "mpClientId", "TEXT"],
    ["AkuoConfig", "mpUserId", "TEXT"],
    ["AkuoConfig", "mpSandbox", "BOOLEAN NOT NULL DEFAULT 1"],
    ["AkuoConfig", "transbankCommerceCode", "TEXT"],
    ["AkuoConfig", "transbankApiKey", "TEXT"],
    ["AkuoConfig", "transbankEnvironment", "TEXT"],
    // AkuoUsuario
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

  return NextResponse.json({ ok: true, results });
}
