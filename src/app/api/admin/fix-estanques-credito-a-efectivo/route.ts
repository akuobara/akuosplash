import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/fix-estanques-credito-a-efectivo
//
// Para cada entrega con detalleEstanquesJson que tenga estanques con montoRecibido=0
// (marcados como "Sin pago"/crédito en el form, aunque el cliente haya pagado):
//   - Cambiar metodoPago del estanque a "efectivo"
//   - Setear montoRecibido del estanque = estanque.total
//   - Recalcular montoEfectivo, montoTransferencia, montoRecibido, estadoPago de la entrega
//
// Esto arregla el bug donde el form marcaba algunos estanques como crédito aunque
// el cliente pagó en efectivo por todo. Es AGRESIVO: asume que TODOS los estanques
// con método "crédito" deberían ser "efectivo" pagado. Si el cliente realmente dejó
// algún estanque a crédito, este fix no aplica a ese caso.
//
// Modo:
//   GET → dry-run (muestra qué se arreglaría, no modifica nada)
//   GET ?confirmar=true → aplica los cambios
async function ejecutar(confirmar: boolean, clienteIdFiltro?: string | null) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const haceUnAno = new Date();
  haceUnAno.setDate(haceUnAno.getDate() - 365);

  // Buscar todas las entregas con detalleEstanquesJson
  const where: any = {
    duenoId,
    detalleEstanquesJson: { not: null },
    fecha: { gte: haceUnAno },
  };
  if (clienteIdFiltro) where.clienteId = clienteIdFiltro;

  const entregas = await db.entrega.findMany({
    where,
    select: {
      id: true,
      clienteId: true,
      fecha: true,
      litros: true,
      total: true,
      montoRecibido: true,
      montoEfectivo: true,
      montoTransferencia: true,
      estadoPago: true,
      detalleEstanquesJson: true,
    },
    orderBy: { fecha: "desc" },
  });

  const arreglos: Array<{
    entregaId: string;
    clienteId: string | null;
    fecha: string;
    total: number;
    montoRecibidoAntes: number;
    montoRecibidoDespues: number;
    estanquesCambiados: number;
    estanques: any[];
  }> = [];

  for (const e of entregas) {
    if (!e.detalleEstanquesJson) continue;
    let estanques: any[];
    try {
      estanques = JSON.parse(e.detalleEstanquesJson);
      if (!Array.isArray(estanques) || estanques.length === 0) continue;
    } catch {
      continue;
    }

    // Ver si hay estanques con montoRecibido=0 que deberían estar pagados
    const estanquesParaArreglar = estanques.filter(
      (est) => Number(est.montoRecibido) === 0 && Number(est.total) > 0
    );
    if (estanquesParaArreglar.length === 0) continue;

    // Crear nueva lista de estanques con los arreglados
    const nuevosEstanques = estanques.map((est) => {
      if (Number(est.montoRecibido) === 0 && Number(est.total) > 0) {
        return {
          ...est,
          metodoPago: "efectivo",
          montoRecibido: Number(est.total),
        };
      }
      return est;
    });

    // Recalcular totales
    const nuevoMontoEfectivo = nuevosEstanques
      .filter((est) => est.metodoPago === "efectivo")
      .reduce((s, est) => s + Number(est.montoRecibido || 0), 0);
    const nuevoMontoTransferencia = nuevosEstanques
      .filter((est) => est.metodoPago === "transferencia")
      .reduce((s, est) => s + Number(est.montoRecibido || 0), 0);
    const nuevoMontoRecibido = nuevoMontoEfectivo + nuevoMontoTransferencia;
    const nuevoEstado = nuevoMontoRecibido >= e.total && e.total > 0
      ? "pagado"
      : nuevoMontoRecibido > 0
        ? "parcial"
        : "pendiente";

    if (confirmar) {
      await db.entrega.update({
        where: { id: e.id },
        data: {
          montoEfectivo: nuevoMontoEfectivo,
          montoTransferencia: nuevoMontoTransferencia,
          montoRecibido: nuevoMontoRecibido,
          estadoPago: nuevoEstado,
          detalleEstanquesJson: JSON.stringify(nuevosEstanques),
        },
      });
    }

    arreglos.push({
      entregaId: e.id,
      clienteId: e.clienteId,
      fecha: String(e.fecha),
      total: e.total,
      montoRecibidoAntes: e.montoRecibido,
      montoRecibidoDespues: nuevoMontoRecibido,
      estanquesCambiados: estanquesParaArreglar.length,
      estanques: nuevosEstanques,
    });
  }

  return NextResponse.json({
    ok: true,
    modo: confirmar ? "aplicado" : "dry-run",
    totalEntregasRevisadas: entregas.length,
    arregladas: arreglos.length,
    detalle: arreglos,
    message: confirmar
      ? `Se arreglaron ${arreglos.length} entrega(s) marcando estanques crédito como efectivo pagado.`
      : `Se detectaron ${arreglos.length} entrega(s) arreglables. Mandá POST con { confirmar: true } o GET ?confirmar=true para aplicar.`,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const confirmar = searchParams.get("confirmar") === "true";
  const clienteId = searchParams.get("clienteId");
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
