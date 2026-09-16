import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/fix-totales-estanques
//
// Arregla las entregas que tienen total mal calculado cuando se usó el modo estanques.
//
// BUG: En algunas versiones anteriores del código, cuando se hacía una entrega con
// modo estanques (detalleEstanquesJson presente), el backend guardaba el total
// como $120.000 (precio del camión completo) en vez del total real (suma de los
// totales de cada estanque). Eso creaba deudas gigantes ficticias.
//
// FIX: Para cada entrega con detalleEstanquesJson:
//   1. Parsea el JSON
//   2. Suma los totales de cada estanque
//   3. Si el total guardado != suma calculada, actualiza la entrega
//   4. También recalcula montoEfectivo/montoTransferencia desde el detalle
//   5. Actualiza estadoPago según montoRecibido vs totalNuevo
async function ejecutar(clienteIdFiltro?: string | null) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const where: any = { duenoId, detalleEstanquesJson: { not: null } };
  if (clienteIdFiltro) where.clienteId = clienteIdFiltro;

  const entregas = await db.entrega.findMany({
    where,
    select: {
      id: true,
      clienteId: true,
      fecha: true,
      litros: true,
      precioPorLitro: true,
      total: true,
      montoRecibido: true,
      montoEfectivo: true,
      montoTransferencia: true,
      estadoPago: true,
      detalleEstanquesJson: true,
    },
    orderBy: { fecha: "desc" },
  });

  const arregladas: Array<{
    id: string;
    clienteId: string;
    fecha: string;
    totalAnterior: number;
    totalNuevo: number;
    montoEfectivoAnterior: number;
    montoEfectivoNuevo: number;
    montoTransferenciaAnterior: number;
    montoTransferenciaNuevo: number;
    montoRecibidoAnterior: number;
    montoRecibidoNuevo: number;
    estadoPagoAnterior: string;
    estadoPagoNuevo: string;
    estanques: any[];
  }> = [];
  let sinCambios = 0;
  let errores = 0;

  for (const e of entregas) {
    try {
      const estanques = JSON.parse(e.detalleEstanquesJson || "[]");
      if (!Array.isArray(estanques) || estanques.length === 0) {
        sinCambios++;
        continue;
      }
      // Sumar totales por estanque
      const totalNuevo = estanques.reduce((s: number, est: any) => s + (Number(est.total) || 0), 0);
      // Recalcular efectivo/transferencia desde el detalle
      const efectivoNuevo = estanques
        .filter((est: any) => est.metodoPago === "efectivo")
        .reduce((s: number, est: any) => s + (Number(est.montoRecibido) || 0), 0);
      const transferenciaNuevo = estanques
        .filter((est: any) => est.metodoPago === "transferencia")
        .reduce((s: number, est: any) => s + (Number(est.montoRecibido) || 0), 0);
      const montoRecibidoNuevo = efectivoNuevo + transferenciaNuevo;

      // Solo actualizar si hay discrepancia
      const necesitaUpdate =
        Math.abs(e.total - totalNuevo) > 1 ||
        Math.abs(e.montoEfectivo - efectivoNuevo) > 1 ||
        Math.abs(e.montoTransferencia - transferenciaNuevo) > 1;

      if (!necesitaUpdate) {
        sinCambios++;
        continue;
      }

      // Recalcular estadoPago
      let estadoPagoNuevo = e.estadoPago;
      if (montoRecibidoNuevo >= totalNuevo && totalNuevo > 0) {
        estadoPagoNuevo = "pagado";
      } else if (montoRecibidoNuevo > 0) {
        estadoPagoNuevo = "parcial";
      } else {
        estadoPagoNuevo = "pendiente";
      }

      await db.entrega.update({
        where: { id: e.id },
        data: {
          total: totalNuevo,
          montoEfectivo: efectivoNuevo,
          montoTransferencia: transferenciaNuevo,
          montoRecibido: montoRecibidoNuevo,
          estadoPago: estadoPagoNuevo,
        },
      });

      arregladas.push({
        id: e.id,
        clienteId: e.clienteId || "",
        fecha: String(e.fecha),
        totalAnterior: e.total,
        totalNuevo,
        montoEfectivoAnterior: e.montoEfectivo,
        montoEfectivoNuevo: efectivoNuevo,
        montoTransferenciaAnterior: e.montoTransferencia,
        montoTransferenciaNuevo: transferenciaNuevo,
        montoRecibidoAnterior: e.montoRecibido,
        montoRecibidoNuevo,
        estadoPagoAnterior: e.estadoPago,
        estadoPagoNuevo,
        estanques,
      });
    } catch (err) {
      errores++;
      console.error(`Error procesando entrega ${e.id}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    totalEntregasRevisadas: entregas.length,
    entregasArregladas: arregladas.length,
    sinCambios,
    errores,
    detalle: arregladas,
    message: `Revisadas ${entregas.length} entregas con detalleEstanquesJson. ${arregladas.length} arregladas, ${sinCambios} sin cambios, ${errores} con error.`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  return ejecutar(clienteId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return ejecutar(body.clienteId);
  } catch {
    return ejecutar(null);
  }
}
