import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/fix-pagos-duplicados
//
// Bug: Cuando se registó el pago de una entrega, en algunos casos se creó:
//   1. El montoRecibido en la entrega (correcto)
//   2. Y TAMBIEN un pago suelto con el mismo monto (duplicado, incorrecto)
//
// Eso genera saldos a favor fantasma en los clientes.
//
// FIX: Para cada pago suelto del último año, buscar si existe una entrega
// del mismo cliente, misma fecha (mismo día) y mismo monto que ya tiene
// montoRecibido >= monto del pago. Si existe, borrar el pago duplicado.
//
// Modos:
//   - dry-run (default GET): solo muestra los duplicados que se van a borrar
//   - confirm (POST con body { confirmar: true }): borra los duplicados
async function ejecutar(confirmar: boolean, clienteIdFiltro?: string | null) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const haceUnAno = new Date();
  haceUnAno.setDate(haceUnAno.getDate() - 365);

  const wherePagos: any = {
    duenoId,
    fecha: { gte: haceUnAno },
  };
  if (clienteIdFiltro) wherePagos.clienteId = clienteIdFiltro;

  const pagos = await db.pago.findMany({
    where: wherePagos,
    select: { id: true, clienteId: true, fecha: true, monto: true, metodoPago: true, descripcion: true, nota: true },
    orderBy: { fecha: "desc" },
  });

  const duplicados: Array<{
    pagoId: string;
    clienteId: string | null;
    pagoFecha: string;
    pagoMonto: number;
    pagoMetodo: string;
    entregaMatchId: string;
    entregaFecha: string;
    entregaMonto: number;
    entregaRecibido: number;
    entregaEstado: string;
  }> = [];

  for (const pago of pagos) {
    if (!pago.clienteId) continue;
    // Buscar entregas del mismo cliente en la misma fecha con monto similar
    const fechaPago = new Date(pago.fecha);
    const inicioDia = new Date(fechaPago);
    inicioDia.setHours(0, 0, 0, 0);
    const finDia = new Date(fechaPago);
    finDia.setHours(23, 59, 59, 999);

    const entregasCercanas = await db.entrega.findMany({
      where: {
        clienteId: pago.clienteId,
        fecha: { gte: inicioDia, lte: finDia },
      },
      select: {
        id: true,
        fecha: true,
        total: true,
        montoRecibido: true,
        estadoPago: true,
      },
    });

    // Buscar si alguna entrega cercana tiene montoRecibido >= monto del pago
    // (es decir, ya se cobró esa entrega y el pago suelto es un duplicado)
    for (const entrega of entregasCercanas) {
      if (entrega.montoRecibido >= pago.monto && entrega.montoRecibido > 0) {
        duplicados.push({
          pagoId: pago.id,
          clienteId: pago.clienteId,
          pagoFecha: String(pago.fecha),
          pagoMonto: pago.monto,
          pagoMetodo: pago.metodoPago,
          entregaMatchId: entrega.id,
          entregaFecha: String(entrega.fecha),
          entregaMonto: entrega.total,
          entregaRecibido: entrega.montoRecibido,
          entregaEstado: entrega.estadoPago,
        });
        break; // un solo match es suficiente
      }
    }
  }

  if (!confirmar) {
    return NextResponse.json({
      ok: true,
      modo: "dry-run (no se borró nada)",
      totalPagosRevisados: pagos.length,
      duplicadosDetectados: duplicados.length,
      duplicados,
      message: `Se detectaron ${duplicados.length} pagos duplicados. Para borrarlos, mandá POST con body { "confirmar": true }.`,
    });
  }

  // Borrar los pagos duplicados
  let borrados = 0;
  for (const dup of duplicados) {
    try {
      await db.pago.delete({ where: { id: dup.pagoId } });
      borrados++;
    } catch (e) {
      console.error(`Error borrando pago ${dup.pagoId}:`, e);
    }
  }

  return NextResponse.json({
    ok: true,
    modo: "confirmado",
    totalPagosRevisados: pagos.length,
    duplicadosBorrados: borrados,
    duplicados,
    message: `Se borraron ${borrados} pagos duplicados. Los saldos a favor fantasma deberían desaparecer.`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = searchParams.get("clienteId");
  const confirmar = searchParams.get("confirmar") === "true";
  return ejecutar(confirmar, clienteId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return ejecutar(body.confirmar === true, body.clienteId);
  } catch {
    return ejecutar(false, null);
  }
}
