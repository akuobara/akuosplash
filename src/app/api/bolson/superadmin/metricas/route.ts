// GET /api/bolson/superadmin/metricas — KPIs del superadmin
import { NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET() {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const [
    totalUsuarios, totalClientes, totalTransportistas, totalSuperadmins,
    transportistasPendientes, transportistasAprobados, transportistasBanned,
    totalSolicitudes, solicitudesAbiertas, solicitudesAdjudicadas, solicitudesEntregadas, solicitudesCanceladas,
    totalServicios, serviciosActivos, serviciosCompletados,
    totalCotizaciones, cotizacionesPendientes, cotizacionesAceptadas, cotizacionesRechazadas,
    totalMontoCotizacionesAceptadas, totalMontoServiciosCompletados,
    totalPagos, pagosConfirmados, montoPagosConfirmados,
    totalMensajes, totalNotificaciones,
    totalValoraciones, promedioRating,
    totalFotos, totalAuditLogs,
  ] = await Promise.all([
    bolsonDb.bolsonUsuario.count(),
    bolsonDb.bolsonUsuario.count({ where: { rol: "cliente" } }),
    bolsonDb.bolsonUsuario.count({ where: { rol: "transportista" } }),
    bolsonDb.bolsonUsuario.count({ where: { rol: "superadmin" } }),
    bolsonDb.bolsonUsuario.count({ where: { rol: "transportista", aprobado: false, banned: false } }),
    bolsonDb.bolsonUsuario.count({ where: { rol: "transportista", aprobado: true, banned: false } }),
    bolsonDb.bolsonUsuario.count({ where: { rol: "transportista", banned: true } }),
    bolsonDb.bolsonSolicitud.count(),
    bolsonDb.bolsonSolicitud.count({ where: { estado: "abierta" } }),
    bolsonDb.bolsonSolicitud.count({ where: { estado: "en_progreso" } }),
    bolsonDb.bolsonSolicitud.count({ where: { estado: "entregada" } }),
    bolsonDb.bolsonSolicitud.count({ where: { estado: "cancelada" } }),
    bolsonDb.bolsonServicio.count(),
    bolsonDb.bolsonServicio.count({ where: { estado: { in: ["asignado", "en_camino_carga", "cargado", "en_camino_entrega", "entregado"] } } }),
    bolsonDb.bolsonServicio.count({ where: { estado: "completado" } }),
    bolsonDb.bolsonCotizacion.count(),
    bolsonDb.bolsonCotizacion.count({ where: { estado: "pendiente" } }),
    bolsonDb.bolsonCotizacion.count({ where: { estado: "aceptada" } }),
    bolsonDb.bolsonCotizacion.count({ where: { estado: "rechazada" } }),
    bolsonDb.bolsonCotizacion.aggregate({ where: { estado: "aceptada" }, _sum: { monto: true } }),
    bolsonDb.bolsonServicio.aggregate({ where: { estado: "completado" }, _sum: { comisionMonto: true } }),
    bolsonDb.bolsonPago.count(),
    bolsonDb.bolsonPago.count({ where: { estado: "confirmado" } }),
    bolsonDb.bolsonPago.aggregate({ where: { estado: "confirmado" }, _sum: { monto: true } }),
    bolsonDb.bolsonMensaje.count(),
    bolsonDb.bolsonNotificacion.count(),
    bolsonDb.bolsonValoracion.count(),
    bolsonDb.bolsonValoracion.aggregate({ _avg: { rating: true } }),
    bolsonDb.bolsonFoto.count(),
    bolsonDb.bolsonAuditLog.count(),
  ]);

  return NextResponse.json({
    usuarios: {
      total: totalUsuarios,
      clientes: totalClientes,
      transportistas: totalTransportistas,
      superadmins: totalSuperadmins,
      transportistasPendientes,
      transportistasAprobados,
      transportistasBanned,
    },
    solicitudes: {
      total: totalSolicitudes,
      abiertas: solicitudesAbiertas,
      adjudicadas: solicitudesAdjudicadas,
      entregadas: solicitudesEntregadas,
      canceladas: solicitudesCanceladas,
    },
    servicios: {
      total: totalServicios,
      activos: serviciosActivos,
      completados: serviciosCompletados,
    },
    cotizaciones: {
      total: totalCotizaciones,
      pendientes: cotizacionesPendientes,
      aceptadas: cotizacionesAceptadas,
      rechazadas: cotizacionesRechazadas,
      montoTotalAceptadas: totalMontoCotizacionesAceptadas._sum.monto || 0,
    },
    pagos: {
      total: totalPagos,
      confirmados: pagosConfirmados,
      montoTotal: montoPagosConfirmados._sum.monto || 0,
    },
    conversacion: {
      mensajes: totalMensajes,
      notificaciones: totalNotificaciones,
    },
    valoraciones: {
      total: totalValoraciones,
      promedioRating: promedioRating._avg.rating || 0,
    },
    fotos: totalFotos,
    auditLogs: totalAuditLogs,
    comisionCobradaTotal: totalMontoServiciosCompletados._sum.comisionMonto || 0,
  });
}
