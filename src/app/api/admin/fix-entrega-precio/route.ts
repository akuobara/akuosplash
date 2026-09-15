import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// POST /api/admin/fix-entrega-precio
// Busca entregas con precioPorLitro=0 pero total incorrecto (recalculado por backend)
// y las arregla usando el precioCamionCompleto de la configuración.
// También arregla entregas donde precioPorLitro > 0 pero el total no cuadra
// con litros × precio (porque el backend recalculó mal).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const { entregaId, precioCorrecto } = body;

    if (entregaId && precioCorrecto) {
      // Fix específico: actualizar una entrega concreta
      const entrega = await db.entrega.findUnique({ where: { id: entregaId } });
      if (!entrega || entrega.duenoId !== duenoId) {
        return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
      }
      await db.entrega.update({
        where: { id: entregaId },
        data: {
          total: Number(precioCorrecto),
          precioPorLitro: 0,
        },
      });
      return NextResponse.json({ ok: true, message: `Entrega actualizada a ${precioCorrecto}` });
    }

    // Fix general: buscar entregas con precioPorLitro=0 y total que no sea múltiplo
    // del precioCamionCompleto de la config
    const config = await db.configuracion.findUnique({ where: { duenoId } });
    const precioCamionCompleto = config?.precioCamionCompleto || 0;

    if (precioCamionCompleto <= 0) {
      return NextResponse.json({ error: "No hay precioCamionCompleto configurado" }, { status: 400 });
    }

    // Buscar entregas con precioPorLitro=0 (camión completo) pero total != precioCamionCompleto
    const entregas = await db.entrega.findMany({
      where: {
        duenoId,
        precioPorLitro: 0,
        total: { not: precioCamionCompleto },
      },
      select: { id: true, clienteNombre: true, litros: true, total: true, fecha: true },
    });

    const arregladas: any[] = [];
    for (const e of entregas) {
      await db.entrega.update({
        where: { id: e.id },
        data: { total: precioCamionCompleto },
      });
      arregladas.push({
        id: e.id,
        cliente: e.clienteNombre,
        totalAntes: e.total,
        totalDespues: precioCamionCompleto,
        fecha: e.fecha,
      });
    }

    return NextResponse.json({
      ok: true,
      precioCamionCompleto,
      arregladas: arregladas.length,
      detalle: arregladas,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) { return POST(req); }
