import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/superadmin/stats — métricas para el dashboard
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const [clientesCount, transportistasCount, pedidosCount, zonasCount, transportistasAprobados, transportistasPendientes, ingresos] = await Promise.all([
    akuosplashDb.akuoUsuario.count({ where: { rol: "cliente", activo: true } }),
    akuosplashDb.akuoUsuario.count({ where: { rol: "transportista" } }),
    akuosplashDb.akuoPedidoCliente.count(),
    akuosplashDb.akuoZona.count({ where: { activa: true } }),
    akuosplashDb.akuoUsuario.count({ where: { rol: "transportista", aprobado: true, activo: true } }),
    akuosplashDb.akuoUsuario.count({ where: { rol: "transportista", aprobado: false } }),
    akuosplashDb.akuoPedidoCliente.aggregate({
      where: { estadoPago: "pagado" },
      _sum: { precioTotal: true },
    }),
  ]);

  const pedidosPorEstado = await akuosplashDb.akuoPedidoCliente.groupBy({ by: ["estado"], _count: true });
  const pedidosPorEstadoObj: Record<string, number> = {};
  pedidosPorEstado.forEach(p => { pedidosPorEstadoObj[p.estado] = p._count; });

  return NextResponse.json({
    clientesCount,
    transportistasCount,
    pedidosCount,
    zonasCount,
    transportistasAprobados,
    transportistasPendientes,
    ingresosTotal: ingresos._sum.precioTotal || 0,
    pedidosPorEstado: pedidosPorEstadoObj,
  });
}
