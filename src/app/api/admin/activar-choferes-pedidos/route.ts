import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// Endpoint TEMPORAL para activar choferesPuedenCrearPedidos=true en producción.
// Una vez ejecutado, eliminar este archivo.
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Upsert configuración
    const existente = await db.configuracion.findUnique({ where: { duenoId } });
    if (existente) {
      const actualizada = await db.configuracion.update({
        where: { duenoId },
        data: { choferesPuedenCrearPedidos: true },
        select: { choferesPuedenCrearPedidos: true, choferesPuedenEditarClientes: true },
      });
      return NextResponse.json({ ok: true, configuracion: actualizada });
    } else {
      const creada = await db.configuracion.create({
        data: { duenoId, choferesPuedenCrearPedidos: true },
        select: { choferesPuedenCrearPedidos: true, choferesPuedenEditarClientes: true },
      });
      return NextResponse.json({ ok: true, configuracion: creada });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
