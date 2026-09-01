import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/global/entregas?limit=200
// Todas las entregas de todos los admins
export async function GET(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 200, 500);

  try {
    const entregas = await db.entrega.findMany({
      orderBy: { fecha: "desc" },
      take: limit,
      select: {
        id: true, fecha: true, clienteNombre: true, litros: true, total: true,
        montoEfectivo: true, montoTransferencia: true, montoRecibido: true,
        estadoPago: true, metodoPago: true,
        dueno: { select: { id: true, nombre: true } },
        chofer: { select: { id: true, nombre: true } },
        vuelta: { select: { numero: true } },
      },
    });
    return NextResponse.json({ entregas });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al obtener entregas" }, { status: 500 });
  }
}
