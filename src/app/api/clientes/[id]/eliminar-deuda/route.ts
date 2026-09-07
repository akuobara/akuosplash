// POST /api/clientes/[id]/eliminar-deuda
// Elimina toda la deuda pendiente del cliente:
// 1. Si metodoPago=efectivo, recalcula las entregas impagas al precio efectivo
// 2. Registra un pago por el monto exacto de la deuda restante (después del recálculo)
// 3. Devuelve el monto final para que el frontend lo muestre
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const metodoPago = body.metodoPago || "efectivo";

  // Verificar que el cliente pertenece al dueño
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente || cliente.duenoId !== duenoId) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  try {
    // 1. Si método es efectivo, recalcular entregas impagas al precio efectivo
    if (metodoPago === "efectivo") {
      const config = await db.configuracion.findUnique({ where: { duenoId } });
      const precioEfectivo = cliente.precioEfectivoPorLitro || config?.precioEfectivoPorLitro || 0;
      const precioTransferencia = cliente.precioTransferenciaPorLitro || config?.precioTransferenciaPorLitro || precioEfectivo;

      if (precioEfectivo > 0 && precioTransferencia > precioEfectivo) {
        const entregasImpagas = await db.entrega.findMany({
          where: {
            clienteId: id,
            estadoPago: { in: ["pendiente", "parcial"] },
            precioPorLitro: { gt: precioEfectivo },
          },
          select: { id: true, litros: true, precioPorLitro: true, montoRecibido: true, descuento: true },
        });

        for (const entrega of entregasImpagas) {
          const totalBruto = entrega.litros * precioEfectivo;
          const totalRedondeado = totalBruto > 0 ? Math.ceil(totalBruto / 100) * 100 : 0;
          const nuevoTotal = Math.max(0, totalRedondeado - (entrega.descuento || 0));

          let nuevoEstado = "pendiente";
          if (entrega.montoRecibido >= nuevoTotal && nuevoTotal > 0) nuevoEstado = "pagado";
          else if (entrega.montoRecibido > 0) nuevoEstado = "parcial";

          await db.entrega.update({
            where: { id: entrega.id },
            data: {
              precioPorLitro: precioEfectivo,
              total: nuevoTotal,
              estadoPago: nuevoEstado,
            },
          });
        }
      }
    }

    // 2. Calcular la deuda EXACTA después del recálculo
    const entregasActualizadas = await db.entrega.findMany({
      where: { clienteId: id },
      select: { total: true, montoRecibido: true },
    });
    const totalVentas = entregasActualizadas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = entregasActualizadas.reduce((s, e) => s + e.montoRecibido, 0);
    const pagosSueltos = await db.pago.findMany({
      where: { clienteId: id },
      select: { monto: true },
    });
    const totalPagosSueltos = pagosSueltos.reduce((s, p) => s + p.monto, 0);
    const deudaInicial = cliente.deudaInicial || 0;
    const totalPorCobrar = deudaInicial + totalVentas - totalRecibido - totalPagosSueltos;

    const monto = Math.round(totalPorCobrar);
    if (monto <= 0) {
      return NextResponse.json({
        ok: true,
        message: "No hay deuda pendiente",
        monto: 0,
        recalculado: metodoPago === "efectivo",
      });
    }

    // 3. Registrar el pago por el monto exacto
    const pago = await db.pago.create({
      data: {
        clienteId: id,
        monto,
        metodoPago,
        nota: "Eliminación de deuda",
        choferId: session.userId,
        duenoId,
      },
    });

    return NextResponse.json({
      ok: true,
      pago,
      monto,
      recalculado: metodoPago === "efectivo",
      message: `Deuda eliminada: ${monto} (${metodoPago})`,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo eliminar la deuda" }, { status: 500 });
  }
}
