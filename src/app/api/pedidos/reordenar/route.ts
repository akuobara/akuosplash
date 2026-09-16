import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// POST /api/pedidos/reordenar
// Body: { pedidos: [{ id: string, orden: number }] }
//
// Actualiza el campo `orden` de cada pedido para persistir el orden
// elegido por el chofer en la vista de lista (drag & drop).
//
// El campo `orden` es opcional y solo se usa para ordenar la lista
// dentro de un mismo día. Si no se setea, el pedido se ordena por
// fecha de creación (default).
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

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
    const pedidos: Array<{ id: string; orden: number }> = body.pedidos;

    if (!Array.isArray(pedidos) || pedidos.length === 0) {
      return NextResponse.json({ error: "Body debe incluir pedidos: [{id, orden}]" }, { status: 400 });
    }

    // Verificar que todos los pedidos pertenecen al duenoId del usuario
    const ids = pedidos.map((p) => p.id);
    const existentes = await db.pedido.findMany({
      where: { id: { in: ids }, duenoId },
      select: { id: true },
    });
    if (existentes.length !== ids.length) {
      return NextResponse.json(
        { error: "Algunos pedidos no existen o no tenés permiso para modificarlos" },
        { status: 403 }
      );
    }

    // Actualizar el campo orden de cada pedido
    // Usar raw SQL si la columna no está en el schema de Prisma (migración lazy)
    let actualizados = 0;
    for (const p of pedidos) {
      try {
        await db.$executeRawUnsafe(
          `UPDATE "Pedido" SET "orden" = ? WHERE "id" = ?;`,
          p.orden,
          p.id
        );
        actualizados++;
      } catch {
        // Si la columna "orden" no existe, crearla y reintentar
        try {
          await db.$executeRawUnsafe(`ALTER TABLE "Pedido" ADD COLUMN "orden" INTEGER DEFAULT 0;`);
          await db.$executeRawUnsafe(
            `UPDATE "Pedido" SET "orden" = ? WHERE "id" = ?;`,
            p.orden,
            p.id
          );
          actualizados++;
        } catch (e2) {
          console.error(`No se pudo actualizar orden para pedido ${p.id}:`, e2);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      actualizados,
      message: `Orden actualizado para ${actualizados} pedido(s).`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
