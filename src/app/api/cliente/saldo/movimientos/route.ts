import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// GET /api/cliente/saldo/movimientos
export async function GET() {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const movimientos = await db.movimientoSaldoClienteApp.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { creadoEn: "desc" },
    take: 100,
    select: {
      id: true,
      creadoEn: true,
      tipo: true,
      monto: true,
      saldoResultante: true,
      descripcion: true,
      metodoCarga: true,
      comprobanteUrl: true,
      confirmado: true,
      confirmadoEn: true,
      pedidoAppId: true,
    },
  });

  const cliente = await db.clienteApp.findUnique({
    where: { id: session.clienteId },
    select: { saldo: true },
  });

  return NextResponse.json({
    movimientos,
    saldoActual: cliente?.saldo || 0,
  });
}
