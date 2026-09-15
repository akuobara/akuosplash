// Fix específico para Bacalemu piscina: total debe ser $120.000
// y precioPorLitro debe ser $0 (camión completo)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    // Buscar la entrega de Bacalemu piscina con total=147900
    const entregas = await db.entrega.findMany({
      where: {
        duenoId,
        clienteNombre: { contains: "Bacalemu" },
        total: 147900,
      },
      select: { id: true, clienteNombre: true, litros: true, total: true, precioPorLitro: true, fecha: true },
    });

    const arregladas: any[] = [];
    for (const e of entregas) {
      await db.entrega.update({
        where: { id: e.id },
        data: {
          total: 120000,
          precioPorLitro: 0,
        },
      });
      arregladas.push({
        id: e.id,
        cliente: e.clienteNombre,
        totalAntes: e.total,
        totalDespues: 120000,
        precioPorLitroAntes: e.precioPorLitro,
        precioPorLitroDespues: 0,
      });
    }

    return NextResponse.json({ ok: true, arregladas: arregladas.length, detalle: arregladas });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST() { return ejecutar(); }
export async function GET() { return ejecutar(); }
