// GET /api/akuosplash/superadmin/metricas — KPIs globales de la plataforma
import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  const [
    totalUsuarios,
    totalClientes,
    totalTransportistas,
    totalSuperadmins,
    transportistasPendientes,
    transportistasBanned,
    totalPedidos,
    pedidosPendientes,
    pedidosEnRuta,
    pedidosEntregados,
    pedidosCancelados,
    totalEntregas,
    totalLitros,
    totalIngresosPlataforma,
    totalPagos,
    pagosConfirmados,
    totalSuscripciones,
    suscripcionesActivas,
    totalVehiculos,
    totalClientesCatalogo,
    totalValoraciones,
    totalAuditLogs,
  ] = await Promise.all([
    akuosplashDb.akuoUsuario.count(),
    akuosplashDb.akuoUsuario.count({ where: { rol: "cliente" } }),
    akuosplashDb.akuoUsuario.count({ where: { rol: "transportista" } }),
    akuosplashDb.akuoUsuario.count({ where: { rol: "superadmin" } }),
    akuosplashDb.akuoUsuario.count({
      where: { rol: "transportista", aprobado: false, banned: false },
    }),
    akuosplashDb.akuoUsuario.count({
      where: { rol: "transportista", banned: true },
    }),
    akuosplashDb.akuoPedido.count(),
    akuosplashDb.akuoPedido.count({ where: { estado: "pendiente" } }),
    akuosplashDb.akuoPedido.count({ where: { estado: "en_ruta" } }),
    akuosplashDb.akuoPedido.count({ where: { estado: "entregado" } }),
    akuosplashDb.akuoPedido.count({ where: { estado: "cancelado" } }),
    akuosplashDb.akuoEntrega.count(),
    akuosplashDb.akuoEntrega.aggregate({ _sum: { litros: true } }),
    akuosplashDb.akuoEntrega.aggregate({ _sum: { total: true } }),
    akuosplashDb.akuoPago.count(),
    akuosplashDb.akuoPago.count({ where: { estado: "confirmado" } }),
    akuosplashDb.akuoSuscripcion.count(),
    akuosplashDb.akuoSuscripcion.count({ where: { estado: "activa" } }),
    akuosplashDb.akuoVehiculo.count(),
    akuosplashDb.akuoCliente.count(),
    akuosplashDb.akuoValoracion.count(),
    akuosplashDb.akuoAuditLog.count(),
  ]);

  // Distribución de planes
  const [planFree, planPro, planEnterprise] = await Promise.all([
    akuosplashDb.akuoUsuario.count({ where: { plan: "free", rol: "transportista" } }),
    akuosplashDb.akuoUsuario.count({ where: { plan: "pro", rol: "transportista" } }),
    akuosplashDb.akuoUsuario.count({ where: { plan: "enterprise", rol: "transportista" } }),
  ]);

  // Ingresos por suscripciones
  const ingresosSuscripciones = await akuosplashDb.akuoSuscripcion.aggregate({
    _sum: { monto: true },
  });

  // Top transportistas por entregas (últimos 30 días)
  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const topTransportistasRaw = await akuosplashDb.akuoEntrega.groupBy({
    by: ["transportistaId"],
    where: { creadoEn: { gte: hace30d } },
    _count: { id: true },
    _sum: { litros: true, total: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });
  const topIds = topTransportistasRaw.map((t) => t.transportistaId);
  const topUsers = await akuosplashDb.akuoUsuario.findMany({
    where: { id: { in: topIds } },
    select: { id: true, nombre: true, razonSocial: true, email: true, plan: true },
  });
  const topTransportistas = topTransportistasRaw.map((t) => {
    const u = topUsers.find((x) => x.id === t.transportistaId);
    return {
      ...t,
      usuario: u,
    };
  });

  return NextResponse.json({
    usuarios: {
      total: totalUsuarios,
      clientes: totalClientes,
      transportistas: totalTransportistas,
      superadmins: totalSuperadmins,
      transportistasPendientes,
      transportistasBanned,
    },
    pedidos: {
      total: totalPedidos,
      pendientes: pedidosPendientes,
      enRuta: pedidosEnRuta,
      entregados: pedidosEntregados,
      cancelados: pedidosCancelados,
    },
    entregas: {
      total: totalEntregas,
      litros: totalLitros._sum.litros || 0,
      ingresosPlataforma: totalIngresosPlataforma._sum.total || 0,
    },
    pagos: {
      total: totalPagos,
      confirmados: pagosConfirmados,
    },
    suscripciones: {
      total: totalSuscripciones,
      activas: suscripcionesActivas,
      ingresos: ingresosSuscripciones._sum.monto || 0,
      distribucionPlanes: {
        free: planFree,
        pro: planPro,
        enterprise: planEnterprise,
      },
    },
    vehiculos: totalVehiculos,
    clientesCatalogo: totalClientesCatalogo,
    valoraciones: totalValoraciones,
    auditLogs: totalAuditLogs,
    topTransportistas,
  });
}
