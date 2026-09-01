import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// POST /api/super-admin/saldo/[id]/rechazar
// Rechaza una carga de saldo por transferencia: no suma nada, marca como rechazada
// Body opcional: { motivo: "..." }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  try {
    const movimiento = await db.movimientoSaldoClienteApp.findUnique({
      where: { id },
      select: { id: true, confirmado: true, tipo: true, metodoCarga: true, clienteId: true, monto: true },
    });

    if (!movimiento) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }
    if (movimiento.confirmado) {
      return NextResponse.json({ error: "El movimiento ya está confirmado, no se puede rechazar" }, { status: 400 });
    }
    if (movimiento.tipo !== "carga" || movimiento.metodoCarga !== "transferencia") {
      return NextResponse.json({ error: "Solo se rechazan cargas por transferencia" }, { status: 400 });
    }

    let motivo = "Transferencia rechazada por el administrador";
    try {
      const body = await req.json();
      if (body.motivo) motivo = String(body.motivo).slice(0, 500);
    } catch {}

    await db.movimientoSaldoClienteApp.update({
      where: { id },
      data: {
        // Reutilizamos el campo descripcion para guardar el motivo del rechazo
        descripcion: `RECHAZADA: ${motivo}`,
      },
    });

    // Eliminamos el movimiento rechazado para que no quede pendiente
    await db.movimientoSaldoClienteApp.delete({ where: { id } });

    return NextResponse.json({ ok: true, mensaje: motivo });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo rechazar" }, { status: 500 });
  }
}
