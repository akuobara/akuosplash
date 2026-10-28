import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { getPlanConfigs, ensureAkuoConfigColumns, PLAN_ORDER, type PlanConfig, type PlanId } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/planes
// Endpoint PÚBLICO (sin auth) que devuelve:
//   - Los 3 planes publicados (gratis, premium, pro) con TODOS sus campos
//   - El fee por retiro manual global (fijo + pct)
//   - Flag de MP sandbox (para que la landing muestre advertencias si corresponde)
//
// Lo usa la landing pública /akuosplash/quiero-repartir para renderizar precios,
// comisiones, fees, límites de vehículos/choferes y matriz de herramientas por plan
// de forma dinámica — cualquier cambio que el superadmin haga en la config se refleja
// automáticamente en la landing sin redeployar.
//
// Response shape:
// {
//   planes: Array<PlanConfig & { orden: number }>,  // ordenados por PLAN_ORDER
//   feeManual: { fijo: number, pct: number },
//   mpSandbox: boolean,
// }

export async function GET() {
  await ensureAkuoConfigColumns();

  // 1. Planes publicados
  const configs = await getPlanConfigs();
  const planes: Array<PlanConfig & { orden: number }> = [];
  for (let i = 0; i < PLAN_ORDER.length; i++) {
    const id = PLAN_ORDER[i] as PlanId;
    const cfg = configs[id];
    if (cfg) {
      planes.push({ ...cfg, orden: i });
    }
  }

  // 2. Fee por retiro manual + mpSandbox desde AkuoConfig
  let feeManual = { fijo: 3290, pct: 1.7 }; // defaults si no están en DB
  let mpSandbox = true;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT retiroFeeFijoGlobal, retiroFeePctGlobal, mpSandbox FROM AkuoConfig WHERE activo = 1 LIMIT 1`
    );
    if (Array.isArray(r) && r.length > 0) {
      const row = r[0];
      if (row.retiroFeeFijoGlobal != null) feeManual.fijo = Number(row.retiroFeeFijoGlobal);
      if (row.retiroFeePctGlobal != null) feeManual.pct = Number(row.retiroFeePctGlobal);
      if (row.mpSandbox != null) mpSandbox = Boolean(row.mpSandbox);
    }
  } catch (e: any) {
    // Si las columnas no existen (DB sin migrar), usar defaults
    console.warn("[/api/akuosplash/planes] fee read failed:", e?.message);
  }

  return NextResponse.json({
    planes,
    feeManual,
    mpSandbox,
    generadoEn: new Date().toISOString(),
  });
}
