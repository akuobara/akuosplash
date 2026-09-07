// POST /api/admin/fix-deudas-chicas
// Endpoint temporal para arreglar deudas pequeñas (< $2.000) que quedaron
// de pagos incompletos antes del fix de "eliminar deuda".
// Registra un pago por la diferencia para dejar la deuda en $0.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Buscar todos los clientes del admin
    const clientes = await db.cliente.findMany({
      where: { duenoId },
      select: { id: true, nombre: true, deudaInicial: true },
    });

    const arreglados: { cliente: string; deudaAntes: number; pagoRegistrado: number }[] = [];

    for (const cliente of clientes) {
      // Calcular deuda actual
      const entregas = await db.entrega.findMany({
        where: { clienteId: cliente.id },
        select: { total: true, montoRecibido: true },
      });
      const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
      const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);

      const pagos = await db.pago.findMany({
        where: { clienteId: cliente.id },
        select: { monto: true },
      });
      const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);

      const deudaInicial = cliente.deudaInicial || 0;
      const totalPorCobrar = deudaInicial + totalVentas - totalRecibido - totalPagos;

      // Si la deuda es positiva pero menor a $2.000, registrar un pago para arreglarla
      if (totalPorCobrar > 0 && totalPorCobrar <= 2000) {
        const monto = Math.round(totalPorCobrar);
        await db.pago.create({
          data: {
            clienteId: cliente.id,
            monto,
            metodoPago: "efectivo",
            nota: "Ajuste automático - deuda residual",
            choferId: session.userId,
            duenoId,
          },
        });
        arreglados.push({
          cliente: cliente.nombre,
          deudaAntes: monto,
          pagoRegistrado: monto,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      arreglados,
      total: arreglados.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// También aceptar GET para poder ejecutarlo desde el navegador
export async function GET(req: NextRequest) {
  return POST(req);
}
