import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/revert-entrega-precio
// Revierte el fix incorrecto de entregas que NO eran camión completo.
export async function ejecutar(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const config = await db.configuracion.findUnique({ where: { duenoId } });
    const precioCamionCompleto = config?.precioCamionCompleto || 0;

    // Buscar todas las entregas con precioPorLitro=0 y total=precioCamionCompleto
    const entregas = await db.entrega.findMany({
      where: { duenoId, precioPorLitro: 0, total: precioCamionCompleto },
      select: { id: true, clienteNombre: true, litros: true, total: true, fecha: true, clienteId: true, detalleEstanquesJson: true, metodoPago: true },
      orderBy: { fecha: "desc" },
    });

    const resultados: any[] = [];
    for (const e of entregas) {
      if (e.detalleEstanquesJson) continue; // no tocar estanques

      // Buscar precio del cliente
      let precio = 0;
      if (e.clienteId) {
        const cliente = await db.cliente.findUnique({
          where: { id: e.clienteId },
          select: { precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true },
        });
        precio = cliente?.precioEfectivoPorLitro || cliente?.precioTransferenciaPorLitro || 0;
      }
      if (precio === 0) {
        precio = config?.precioEfectivoPorLitro || config?.precioTransferenciaPorLitro || 0;
      }

      if (precio === 0) {
        resultados.push({ id: e.id, cliente: e.clienteNombre, litros: e.litros, totalActual: e.total, accion: "NO SE PUEDE REVERTIR (sin precio)" });
        continue;
      }

      const totalCorrecto = Math.ceil((e.litros * precio) / 100) * 100;

      if (totalCorrecto !== e.total) {
        // Revertir
        await db.entrega.update({
          where: { id: e.id },
          data: { total: totalCorrecto },
        });
        resultados.push({
          id: e.id,
          cliente: e.clienteNombre,
          litros: e.litros,
          totalAntes: e.total,
          totalDespues: totalCorrecto,
          precioPorLitro: precio,
          accion: "REVERTIDO",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      encontradas: entregas.length,
      revertidas: resultados.filter(r => r.accion === "REVERTIDO").length,
      detalle: resultados,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) { return ejecutar(req); }
export async function GET(req: NextRequest) { return ejecutar(req); }
