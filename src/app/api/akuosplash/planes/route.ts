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

  // 1. Planes publicados — incluir planes custom de AkuoPlanConfig
  const configs = await getPlanConfigs();
  const planes: Array<PlanConfig & { orden: number }> = [];

  // Construir orden dinámico: PLAN_ORDER base + planes custom de la DB
  const ordenIds: string[] = [...PLAN_ORDER];
  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const r = await client.execute("SELECT id, orden FROM AkuoPlanConfig WHERE activo = 1 AND id NOT IN ('gratis','premium','pro') ORDER BY orden ASC");
    for (const row of r.rows) {
      const id = (row as any).id;
      if (!ordenIds.includes(id)) ordenIds.push(id);
    }
  } catch {}

  for (let i = 0; i < ordenIds.length; i++) {
    const id = ordenIds[i];
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
