import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/diagnostic-cliente?nombre=...
// Endpoint temporal: muestra info detallada de un cliente (entregas + pagos + deuda calculada)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-diag-secret");
  if (secret !== "aljibe-diag-2026") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clienteNombre = searchParams.get("nombre");

  if (!clienteNombre) {
    return NextResponse.json({ error: "Falta parámetro ?nombre=..." }, { status: 400 });
  }

  try {
    const clientes = await db.cliente.findMany({
      where: { nombre: { contains: clienteNombre } },
      select: {
        id: true, nombre: true, deudaInicial: true,
        precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true, precioCamionCompleto: true,
        duenoId: true,
      },
    });

    const resultado = [];
    for (const cliente of clientes) {
      const config = await db.configuracion.findUnique({ where: { duenoId: cliente.duenoId } });
      const entregas = await db.entrega.findMany({
        where: { clienteId: cliente.id },
        orderBy: { fecha: "asc" },
        select: {
          id: true, fecha: true, litros: true, precioPorLitro: true, total: true,
          montoRecibido: true, montoEfectivo: true, montoTransferencia: true,
          estadoPago: true, metodoPago: true,
        },
      });

      const pagos = await db.pago.findMany({
        where: { clienteId: cliente.id },
        orderBy: { fecha: "asc" },
        select: { id: true, fecha: true, monto: true, metodoPago: true, descripcion: true },
      });

      const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
      const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
      const totalPagos = pagos.reduce((s, p) => s + p.monto, 0);
      const deudaCalculada = cliente.deudaInicial + totalVentas - totalRecibido - totalPagos;

      resultado.push({
        cliente: {
          id: cliente.id,
          nombre: cliente.nombre,
          deudaInicial: cliente.deudaInicial,
          precioEfectivoPorLitro: cliente.precioEfectivoPorLitro,
          precioTransferenciaPorLitro: cliente.precioTransferenciaPorLitro,
          precioCamionCompleto: cliente.precioCamionCompleto,
          configGlobal: {
            precioEfectivo: config?.precioEfectivoPorLitro,
            precioTransferencia: config?.precioTransferenciaPorLitro,
          },
        },
        entregas,
        pagos,
        resumenCalculado: {
          totalVentas,
          totalRecibido,
          totalPagos,
          deudaInicial: cliente.deudaInicial,
          deudaCalculada,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      clientes: resultado,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "diag failed", details: msg }, { status: 500 });
  }
}
