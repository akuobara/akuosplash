import { NextResponse } from "next/server";
import { getPrecioPorLitro, getComisionPorcentaje } from "@/lib/akuosplash-mercadopago";

// GET /api/akuosplash/config/precios
// Endpoint público — devuelve el precio por litro y la comisión de la app
export async function GET() {
  return NextResponse.json({
    precioPorLitro: getPrecioPorLitro(),
    comisionPct: getComisionPorcentaje(),
  });
}
