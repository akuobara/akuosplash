import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-entrega?id=XXX
// GET /api/admin/debug-entrega?clienteId=XXX
// Muestra TODOS los campos de una entrega, incluyendo detalleEstanquesJson parseado.
// Útil para diagnosticar entregas con total incorrecto.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const clienteId = searchParams.get("clienteId");

  if (id) {
    const entrega = await db.entrega.findUnique({
      where: { id },
    });
    if (!entrega || entrega.duenoId !== duenoId) {
      return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
    }
    let detalleEstanques: any = null;
    try {
      if (entrega.detalleEstanquesJson) {
        detalleEstanques = JSON.parse(entrega.detalleEstanquesJson);
      }
    } catch (e) {
      detalleEstanques = { error: "JSON inválido", raw: entrega.detalleEstanquesJson };
    }
    return NextResponse.json({
      entrega: {
        ...entrega,
        detalleEstanques,
      },
      diagnostico: {
        litros: entrega.litros,
        precioPorLitro: entrega.precioPorLitro,
        totalEsperado: entrega.litros * entrega.precioPorLitro,
        totalGuardado: entrega.total,
        discrepancia: entrega.total - entrega.litros * entrega.precioPorLitro,
        montoRecibido: entrega.montoRecibido,
        estadoPago: entrega.estadoPago,
      },
    });
  }

  if (clienteId) {
    const entregas = await db.entrega.findMany({
      where: { clienteId, duenoId },
      select: {
        id: true,
        fecha: true,
        litros: true,
        precioPorLitro: true,
        total: true,
        montoRecibido: true,
        montoEfectivo: true,
        montoTransferencia: true,
        estadoPago: true,
        metodoPago: true,
        detalleEstanquesJson: true,
      },
      orderBy: { fecha: "desc" },
    });
    return NextResponse.json({
      total: entregas.length,
      entregas: entregas.map((e) => {
        let detalle: any = null;
        try {
          if (e.detalleEstanquesJson) detalle = JSON.parse(e.detalleEstanquesJson);
        } catch {
          detalle = { error: "JSON inválido" };
        }
        return {
          id: e.id,
          fecha: String(e.fecha),
          litros: e.litros,
          precioPorLitro: e.precioPorLitro,
          totalGuardado: e.total,
          totalEsperado: e.litros * e.precioPorLitro,
          discrepancia: e.total - e.litros * e.precioPorLitro,
          montoRecibido: e.montoRecibido,
          montoEfectivo: e.montoEfectivo,
          montoTransferencia: e.montoTransferencia,
          estadoPago: e.estadoPago,
          metodoPago: e.metodoPago,
          detalleEstanques: detalle,
        };
      }),
    });
  }

  return NextResponse.json({
    error: "Especifica ?id=XXX o ?clienteId=XXX",
  }, { status: 400 });
}
