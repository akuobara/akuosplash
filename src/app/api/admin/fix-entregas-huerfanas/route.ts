// POST /api/admin/fix-entregas-huerfanas
// Busca entregas sin clienteId (ingreso manual) y las asocia al cliente
// cuyo nombre coincida exactamente. Solo asocia si hay un match único.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

async function ejecutar() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    // Buscar todas las entregas sin clienteId de este admin
    const entregasHuerfanas = await db.entrega.findMany({
      where: {
        duenoId,
        clienteId: null,
      },
      select: { id: true, clienteNombre: true },
    });

    // Buscar todos los clientes del admin para hacer matching
    const clientes = await db.cliente.findMany({
      where: { duenoId },
      select: { id: true, nombre: true },
    });

    // Crear un map de nombre -> clienteId (case-insensitive, trim)
    const clientesMap = new Map<string, { id: string; nombre: string }>();
    for (const c of clientes) {
      clientesMap.set(c.nombre.trim().toLowerCase(), { id: c.id, nombre: c.nombre });
    }

    const arregladas: { entregaId: string; clienteNombre: string; clienteId: string }[] = [];
    const noMatch: { entregaId: string; clienteNombre: string; sugerencias: string[] }[] = [];

    for (const entrega of entregasHuerfanas) {
      const nombreBuscado = (entrega.clienteNombre || "").trim().toLowerCase();
      const match = clientesMap.get(nombreBuscado);

      if (match) {
        // Asociar la entrega al cliente
        await db.entrega.update({
          where: { id: entrega.id },
          data: { clienteId: match.id },
        });
        arregladas.push({
          entregaId: entrega.id,
          clienteNombre: entrega.clienteNombre || "",
          clienteId: match.id,
        });
      } else {
        // Buscar coincidencias parciales para sugerir
        const sugerencias = clientes
          .filter(c => {
            const n = c.nombre.toLowerCase();
            return n.includes(nombreBuscado) || nombreBuscado.includes(n);
          })
          .slice(0, 3)
          .map(c => c.nombre);
        noMatch.push({
          entregaId: entrega.id,
          clienteNombre: entrega.clienteNombre || "",
          sugerencias,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      totalHuerfanas: entregasHuerfanas.length,
      arregladas: arregladas.length,
      noMatch: noMatch.length,
      detalleArregladas: arregladas,
      detalleNoMatch: noMatch,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(_req: NextRequest) {
  return ejecutar();
}

export async function GET(req: NextRequest) {
  return ejecutar();
}
