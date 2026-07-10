import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRange } from "@/lib/helpers";

// GET /api/vueltas?period=hoy|semana|mes|todo
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "todo";
  const { start, end } = getRange(period);

  const vueltas = await db.vuelta.findMany({
    where: {
      AND: [
        start ? { iniciadaEn: { gte: start } } : {},
        end ? { iniciadaEn: { lt: end } } : {},
      ],
    },
    include: {
      _count: { select: { entregas: true } },
      entregas: {
        select: {
          id: true,
          litros: true,
          total: true,
          montoRecibido: true,
          clienteNombre: true,
          metodoPago: true,
        },
      },
    },
    orderBy: { iniciadaEn: "desc" },
  });

  // Para cada vuelta, calcular monto a pagar al chofer
  const vueltasCalculadas = vueltas.map((v) => {
    const numEntregas = v._count.entregas;
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
    const efectivoRecibido = v.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    return {
      id: v.id,
      numero: v.numero,
      iniciadaEn: v.iniciadaEn,
      cerradaEn: v.cerradaEn,
      activa: v.activa,
      nota: v.nota,
      cantidadEntregas: numEntregas,
      litros,
      ventas,
      efectivoRecibido,
      esMultiple: numEntregas > 1,
    };
  });

  return NextResponse.json({ vueltas: vueltasCalculadas });
}

// POST /api/vueltas — inicia una nueva vuelta (cierra la activa automáticamente)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    // Cerrar la vuelta activa actual si existe
    const activaActual = await db.vuelta.findFirst({ where: { activa: true } });
    if (activaActual) {
      await db.vuelta.update({
        where: { id: activaActual.id },
        data: { activa: false, cerradaEn: new Date() },
      });
    }

    // Calcular el siguiente número de vuelta
    const ultima = await db.vuelta.findFirst({ orderBy: { numero: "desc" } });
    const siguienteNumero = (ultima?.numero ?? 0) + 1;

    const nueva = await db.vuelta.create({
      data: {
        numero: siguienteNumero,
        nota: body.nota?.trim() || null,
        activa: true,
      },
    });

    return NextResponse.json({ vuelta: nueva }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo iniciar la vuelta" }, { status: 500 });
  }
}
