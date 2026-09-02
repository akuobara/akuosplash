import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// GET /api/cliente/entregas — historial de pedidos/entregas del cliente-app
export async function GET() {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pedidos = await db.pedidoApp.findMany({
    where: { clienteId: session.clienteId },
    orderBy: { creadoEn: "desc" },
    select: {
      id: true,
      creadoEn: true,
      litros: true,
      monto: true,
      comisionApp: true,
      montoProveedor: true,
      estado: true,
      estadoPago: true,
      metodoPago: true,
      direccion: true,
      nota: true,
      tomadoEn: true,
      entregadoEn: true,
      canceladoEn: true,
      canceladoPor: true,
      motivoCancelacion: true,
      reembolsoMonto: true,
      tomadoPor: { select: { id: true, nombre: true } },
      zona: { select: { id: true, nombre: true, precioPorLitro: true } },
    },
  });

  const totalPedidos = pedidos.length;
  const entregados = pedidos.filter(p => p.estado === "entregado");
  const totalLitros = entregados.reduce((s, p) => s + p.litros, 0);
  const totalGastado = entregados.reduce((s, p) => s + p.monto, 0);
  const enProceso = pedidos.filter(p => ["en_pool", "preferido_notificado", "asignado", "en_camino"].includes(p.estado)).length;

  return NextResponse.json({
    pedidos,
    resumen: {
      totalPedidos,
      entregados: entregados.length,
      totalLitros,
      totalGastado,
      enProceso,
    },
  });
}
