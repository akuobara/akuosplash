import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Endpoint TEMPORAL para corregir entregas con total=0 pero detalleEstanquesJson
// no vacío. Recalcula el total sumando los totales de cada estanque.
// Ejecutar una sola vez y luego borrar este archivo.
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  // Buscar entregas con detalleEstanquesJson no vacío
  const entregas = await db.entrega.findMany({
    where: {
      detalleEstanquesJson: { not: null },
    },
    select: {
      id: true,
      total: true,
      montoRecibido: true,
      estadoPago: true,
      detalleEstanquesJson: true,
      fecha: true,
      clienteNombre: true,
    },
  });

  const results: { id: string; cliente: string; totalViejo: number; totalNuevo: number; corregido: boolean }[] = [];
  let corregidas = 0;

  for (const e of entregas) {
    if (!e.detalleEstanquesJson) continue;

    try {
      const estanques = JSON.parse(e.detalleEstanquesJson);
      if (!Array.isArray(estanques)) continue;

      const totalNuevo = estanques.reduce((s: number, est: any) => s + (Number(est.total) || 0), 0);

      // Si el total nuevo es distinto del actual (especialmente si el actual es 0), corregir
      if (totalNuevo > 0 && Math.abs(totalNuevo - e.total) > 1) {
        // Recalcular estadoPago
        let nuevoEstado = "pendiente";
        if (e.montoRecibido >= totalNuevo && totalNuevo > 0) nuevoEstado = "pagado";
        else if (e.montoRecibido > 0) nuevoEstado = "parcial";

        await db.entrega.update({
          where: { id: e.id },
          data: {
            total: totalNuevo,
            estadoPago: nuevoEstado,
          },
        });

        results.push({
          id: e.id,
          cliente: e.clienteNombre,
          totalViejo: e.total,
          totalNuevo,
          corregido: true,
        });
        corregidas++;
      } else {
        results.push({
          id: e.id,
          cliente: e.clienteNombre,
          totalViejo: e.total,
          totalNuevo,
          corregido: false,
        });
      }
    } catch (err) {
      // JSON inválido — saltar
    }
  }

  return NextResponse.json({
    ok: true,
    totalEntregas: entregas.length,
    corregidas,
    results: results.slice(0, 50), // limit output
  });
}
