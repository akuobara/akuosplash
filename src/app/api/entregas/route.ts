import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange } from "@/lib/helpers";

// GET /api/entregas?period=...&clienteId=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "todo";
  const clienteId = searchParams.get("clienteId");
  const { start, end } = getRange(period);

  const where: Record<string, unknown> = {
    duenoId,
    AND: [
      start ? { fecha: { gte: start } } : {},
      end ? { fecha: { lt: end } } : {},
      clienteId ? { clienteId } : {},
    ],
  };

  if (session.role === "chofer") {
    where.choferId = session.userId;
  }

  const entregas = await db.entrega.findMany({
    where,
    include: {
      vuelta: { select: { id: true, numero: true, activa: true } },
    },
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json({ entregas });
}

// POST /api/entregas
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();

    const litros = Number(body.litros) || 0;
    const precioPorLitro = Number(body.precioPorLitro) || 0;
    const total = Number(body.total) || litros * precioPorLitro;

    const metodoPago = body.metodoPago || "efectivo";
    const montoEfectivo = Number(body.montoEfectivo) || 0;
    const montoTransferencia = Number(body.montoTransferencia) || 0;
    const montoRecibido = montoEfectivo + montoTransferencia;

    let estadoPago = body.estadoPago || "pendiente";
    if (!body.estadoPago) {
      if (montoRecibido >= total && total > 0) estadoPago = "pagado";
      else if (montoRecibido > 0) estadoPago = "parcial";
      else estadoPago = "pendiente";
    }

    let litrosFinal = litros;
    if (!litrosFinal && body.lecturaAnterior != null && body.lecturaActual != null) {
      litrosFinal = Number(body.lecturaActual) - Number(body.lecturaAnterior);
    }

    // Vuelta activa
    let vueltaId = body.vueltaId || null;
    if (!vueltaId) {
      const where: Record<string, unknown> = { activa: true, duenoId };
      if (session.role === "chofer") {
        where.choferId = session.userId;
      }
      const activa = await db.vuelta.findFirst({ where });
      vueltaId = activa?.id ?? null;
    }

    const nueva = await db.entrega.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        clienteNombre: body.clienteNombre?.trim() || "Sin nombre",
        clienteDireccion: body.clienteDireccion?.trim() || null,
        clienteTelefono: body.clienteTelefono?.trim() || null,
        clienteZona: body.clienteZona?.trim() || null,
        clienteId: body.clienteId || null,
        vueltaId,
        choferId: session.userId,
        duenoId,
        lecturaAnterior: body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null,
        lecturaActual: body.lecturaActual != null ? Number(body.lecturaActual) : null,
        litros: litrosFinal,
        metodoPago,
        precioPorLitro,
        total,
        montoEfectivo,
        montoTransferencia,
        montoRecibido,
        estadoPago,
        fotoMedidorUrl: body.fotoMedidorUrl || null,
        nota: body.nota?.trim() || null,
        detalleEstanquesJson: body.detalleEstanquesJson || null,
      },
      include: {
        vuelta: { select: { id: true, numero: true, activa: true } },
      },
    });

    return NextResponse.json({ entrega: nueva }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear la entrega" }, { status: 500 });
  }
}
