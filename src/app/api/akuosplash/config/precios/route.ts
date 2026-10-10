import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { getComisionPorcentaje } from "@/lib/akuosplash-mercadopago";

// GET /api/akuosplash/config/precios
// Endpoint público — devuelve la comisión de la app y precios de planes
// (precioPorLitro ya no aplica — ahora depende de la zona del cliente y el motor de precio dinámico)
export async function GET() {
  const config = await akuosplashDb.akuoConfig.findFirst();
  const comisionPct = await getComisionPorcentaje();
  return NextResponse.json({
    comisionPct,
    precioPlanPro: config?.precioPlanPro ?? 15000,
    precioPlanEnterprise: config?.precioPlanEnterprise ?? 50000,
    precioDinamicoHabilitado: config?.precioDinamicoHabilitado ?? false,
  });
}
