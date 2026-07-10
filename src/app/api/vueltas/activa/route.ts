import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/vueltas/activa — devuelve la vuelta activa (o null si no hay)
export async function GET() {
  const activa = await db.vuelta.findFirst({
    where: { activa: true },
    include: {
      entregas: {
        select: {
          id: true,
          litros: true,
          total: true,
          montoRecibido: true,
          clienteNombre: true,
          metodoPago: true,
          fecha: true,
        },
        orderBy: { fecha: "asc" },
      },
    },
  });

  if (!activa) {
    return NextResponse.json({ vuelta: null });
  }

  const litros = activa.entregas.reduce((s, e) => s + e.litros, 0);
  const ventas = activa.entregas.reduce((s, e) => s + e.total, 0);
  const efectivo = activa.entregas.reduce((s, e) => s + e.montoRecibido, 0);

  return NextResponse.json({
    vuelta: {
      id: activa.id,
      numero: activa.numero,
      iniciadaEn: activa.iniciadaEn,
      nota: activa.nota,
      cantidadEntregas: activa.entregas.length,
      litros,
      ventas,
      efectivoRecibido: efectivo,
      entregas: activa.entregas,
    },
  });
}
