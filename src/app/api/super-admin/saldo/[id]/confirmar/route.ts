import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// POST /api/super-admin/saldo/[id]/confirmar
// Confirma una carga de saldo por transferencia: suma el monto al saldo del cliente
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;

  try {
    const movimiento = await db.movimientoSaldoClienteApp.findUnique({
      where: { id },
      include: { cliente: { select: { id: true, saldo: true, nombre: true } } },
    });

    if (!movimiento) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }
    if (movimiento.confirmado) {
      return NextResponse.json({ error: "El movimiento ya está confirmado" }, { status: 400 });
    }
    if (movimiento.tipo !== "carga" || movimiento.metodoCarga !== "transferencia") {
      return NextResponse.json({ error: "Solo se confirman cargas por transferencia" }, { status: 400 });
    }

    // Transacción: sumar al saldo del cliente + marcar movimiento como confirmado
    const nuevoSaldo = movimiento.cliente.saldo + movimiento.monto;

    await db.$transaction([
      db.movimientoSaldoClienteApp.update({
        where: { id },
        data: {
          confirmado: true,
          confirmadoEn: new Date(),
          saldoResultante: nuevoSaldo,
          descripcion: `Carga confirmada por super admin (${session.userId})`,
        },
      }),
      db.clienteApp.update({
        where: { id: movimiento.clienteId },
        data: { saldo: nuevoSaldo },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      movimiento: {
        id: movimiento.id,
        monto: movimiento.monto,
        nuevoSaldo,
        cliente: movimiento.cliente.nombre,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "No se pudo confirmar" }, { status: 500 });
  }
}
