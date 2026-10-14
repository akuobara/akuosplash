import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { getComisionPorcentaje } from "@/lib/akuosplash-mercadopago";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/config/precios
// Endpoint público — devuelve la comisión de la app y precios de planes
// (precioPorLitro ya no aplica — ahora depende de la zona del cliente y el motor de precio dinámico)
// DEFENSIVE: usa raw SQL porque AkuoConfig.findFirst() puede fallar si hay columnas nuevas no migradas
export async function GET() {
  await ensureAkuoConfigColumns();
  const comisionPct = await getComisionPorcentaje();
  let precioPlanPro = 15000;
  let precioPlanEnterprise = 50000;
  let precioDinamicoHabilitado = false;
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(`SELECT precioPlanPro, precioPlanEnterprise, precioDinamicoHabilitado FROM AkuoConfig WHERE activo = 1 LIMIT 1`);
    if (Array.isArray(result) && result.length > 0) {
      precioPlanPro = result[0].precioPlanPro ?? 15000;
      precioPlanEnterprise = result[0].precioPlanEnterprise ?? 50000;
      precioDinamicoHabilitado = !!result[0].precioDinamicoHabilitado;
    }
  } catch {
    // usar defaults
  }
  return NextResponse.json({
    comisionPct,
    precioPlanPro,
    precioPlanEnterprise,
    precioDinamicoHabilitado,
  });
}
