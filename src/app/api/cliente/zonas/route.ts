import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/cliente/zonas — lista pública de zonas activas para que el cliente elija al registrarse
export async function GET() {
  const zonas = await db.zona.findMany({
    where: { activa: true },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      precioPorLitro: true,
      centroLat: true,
      centroLng: true,
      radioKm: true,
    },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ zonas });
}
