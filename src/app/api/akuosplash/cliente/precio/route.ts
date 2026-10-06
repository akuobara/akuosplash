import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPrecioPorLitro, getComisionPorcentaje } from "@/lib/akuosplash-mercadopago";

// GET /api/akuosplash/cliente/precio?comuna=Vitacura
// Devuelve el precio por litro y comisión según la comuna del cliente logueado
// Requiere auth — el precio NO es público
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo clientes" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const comuna = searchParams.get("comuna") || (user as any).comuna || undefined;
  const precioPorLitro = await getPrecioPorLitro(comuna || undefined);
  const comisionPct = await getComisionPorcentaje();
  return NextResponse.json({ precioPorLitro, comisionPct, comuna: comuna || null });
}
