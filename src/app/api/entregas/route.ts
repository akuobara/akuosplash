import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange } from "@/lib/helpers";

// GET /api/entregas?period=hoy|semana|mes|todo&clienteId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "todo";
  const clienteId = searchParams.get("clienteId");

  const { start, end } = getRange(period);

  const entregas = await db.entrega.findMany({
    where: {
      AND: [
        start ? { fecha: { gte: start } } : {},
        end ? { fecha: { lt: end } } : {},
        clienteId ? { clienteId } : {},
      ],
    },
    orderBy: { fecha: "desc" },
  });

  return NextResponse.json({ entregas });
}

// POST /api/entregas
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const litros = Number(body.litros) || 0;
    const precioPorLitro = Number(body.precioPorLitro) || 0;
    const total = Number(body.total) || litros * precioPorLitro;
    const montoRecibido = Number(body.montoRecibido) || 0;

    // Calcular estado de pago automáticamente si no viene
    let estadoPago = body.estadoPago || "pendiente";
    if (!body.estadoPago) {
      if (montoRecibido >= total && total > 0) estadoPago = "pagado";
      else if (montoRecibido > 0) estadoPago = "parcial";
      else estadoPago = "pendiente";
    }

    // Si litros no vino pero hay lecturas, calcularlas
    let litrosFinal = litros;
    if (!litrosFinal && body.lecturaAnterior != null && body.lecturaActual != null) {
      litrosFinal = Number(body.lecturaActual) - Number(body.lecturaAnterior);
    }

    const nueva = await db.entrega.create({
      data: {
        fecha: body.fecha ? new Date(body.fecha) : new Date(),
        clienteNombre: body.clienteNombre?.trim() || "Sin nombre",
        clienteDireccion: body.clienteDireccion?.trim() || null,
        clienteTelefono: body.clienteTelefono?.trim() || null,
        clienteId: body.clienteId || null,
        lecturaAnterior: body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null,
        lecturaActual: body.lecturaActual != null ? Number(body.lecturaActual) : null,
        litros: litrosFinal,
        precioPorLitro,
        total,
        montoRecibido,
        estadoPago,
        fotoMedidorUrl: body.fotoMedidorUrl || null,
        nota: body.nota?.trim() || null,
      },
    });

    return NextResponse.json({ entrega: nueva }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear la entrega" }, { status: 500 });
  }
}
