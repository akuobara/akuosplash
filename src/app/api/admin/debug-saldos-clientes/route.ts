import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/debug-saldos-clientes
// Lista TODOS los clientes con su deuda/saldo calculado.
// Marca cuáles tienen saldo a favor (saldo < 0) y cuánto.
// Útil para detectar clientes con saldo a favor fantasma que no deberían tenerlo.
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clientes = await db.cliente.findMany({
    where: { duenoId },
    select: {
      id: true,
      nombre: true,
      deudaInicial: true,
    },
    orderBy: { nombre: "asc" },
  });

  const resultado: Array<{
    id: string;
    nombre: string;
    deudaInicial: number;
    totalVentas: number;
    totalRecibido: number;
    totalPagosSueltos: number;
    saldoFinal: number;
    tieneSaldoFavor: boolean;
    cantidadEntregas: number;
    cantidadPagos: number;
  }> = [];

  for (const c of clientes) {
    const [entregas, pagos] = await Promise.all([
      db.entrega.findMany({
        where: { clienteId: c.id },
        select: { total: true, montoRecibido: true },
      }),
      db.pago.findMany({
        where: { clienteId: c.id },
        select: { monto: true },
      }),
    ]);

    const totalVentas = entregas.reduce((s, e) => s + e.total, 0);
    const totalRecibido = entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const totalPagosSueltos = pagos.reduce((s, p) => s + p.monto, 0);
    const deudaInicial = c.deudaInicial || 0;
    const saldoFinal = deudaInicial + totalVentas - totalRecibido - totalPagosSueltos;

    resultado.push({
      id: c.id,
      nombre: c.nombre,
      deudaInicial,
      totalVentas,
      totalRecibido,
      totalPagosSueltos,
      saldoFinal,
      tieneSaldoFavor: saldoFinal < 0,
      cantidadEntregas: entregas.length,
      cantidadPagos: pagos.length,
    });
  }

  // Ordenar: primero los que tienen saldo a favor (más negativo primero)
  resultado.sort((a, b) => a.saldoFinal - b.saldoFinal);

  const conSaldoFavor = resultado.filter((r) => r.tieneSaldoFavor);
  const totalRegalado = conSaldoFavor.reduce((s, r) => s + Math.abs(r.saldoFinal), 0);

  return NextResponse.json({
    resumen: {
      totalClientes: resultado.length,
      clientesConSaldoFavor: conSaldoFavor.length,
      totalSaldoFavor: totalRegalado,
      totalDeuda: resultado
        .filter((r) => r.saldoFinal > 0)
        .reduce((s, r) => s + r.saldoFinal, 0),
    },
    clientesConSaldoFavor: conSaldoFavor,
    todosLosClientes: resultado,
  });
}
