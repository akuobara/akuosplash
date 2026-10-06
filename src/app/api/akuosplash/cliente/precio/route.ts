import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPrecioPorLitro, getComisionPorcentaje } from "@/lib/akuosplash-mercadopago";

// GET /api/akuosplash/cliente/precio?lat=-33.4&lng=-70.6&comuna=Vitacura
// Devuelve el precio por litro y comisión según la zona del cliente
// Requiere auth — el precio NO es público
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo clientes" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const comunaParam = searchParams.get("comuna");

  // Si no hay query params, usar la ubicación del perfil del cliente
  const lat = latParam ? Number(latParam) : (user as any).lat;
  const lng = lngParam ? Number(lngParam) : (user as any).lng;
  const comuna = comunaParam || (user as any).comuna || undefined;

  const { precio, zona, precioDefault } = await getPrecioPorLitro(lat, lng, comuna);
  const comisionPct = await getComisionPorcentaje();
  return NextResponse.json({
    precioPorLitro: precio,
    comisionPct,
    zona: zona ? { id: zona.id, nombre: zona.nombre, litrosMinimos: zona.litrosMinimos } : null,
    precioDefault,
    esDefault: zona === null,
    ubicacion: { lat, lng, comuna },
  });
}
