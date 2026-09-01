import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";
import { formatCurrency, formatNumber, formatDate, formatTime } from "@/lib/helpers";

// GET /api/cliente/entregas — historial de entregas del cliente logueado
export async function GET() {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const entregas = await db.entrega.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { fecha: "desc" },
    select: {
      id: true,
      fecha: true,
      litros: true,
      total: true,
      montoEfectivo: true,
      montoTransferencia: true,
      montoRecibido: true,
      estadoPago: true,
      metodoPago: true,
      nota: true,
      vuelta: { select: { numero: true } },
    },
  });

  const totalEntregas = entregas.length;
  const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
  const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
  const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
  const saldoPendiente = Math.max(0, totalVentas - totalRecibido);

  return NextResponse.json({
    entregas,
    resumen: {
      totalEntregas,
      totalLitros,
      totalVentas,
      totalRecibido,
      saldoPendiente,
    },
  });
}
