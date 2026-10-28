import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { getPlanActivo, getPlanConfigs, PLAN_ORDER, normalizePlanId } from "@/lib/akuosplash-plans";

export async function GET(req: Request) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ user: null, hasUsers: true });

  const url = new URL(req.url);
  const withPerfil = url.searchParams.get("perfil") === "true";
  const previewPlan = url.searchParams.get("previewPlan"); // "gratis" | "pago" | "pro" (superadmin preview)

  if (withPerfil) {
    // Versión con datos completos del perfil (como Aljibe /api/auth/me?perfil=true)
    const vehiculos = await akuosplashDb.akuoVehiculo.findMany({
      where: { transportistaId: user.id, activo: true },
      orderBy: { creadoEn: "desc" },
    });
    const totalEntregas = await akuosplashDb.akuoEntrega.count({ where: { transportistaId: user.id } });
    const entregas = await akuosplashDb.akuoEntrega.findMany({
      where: { transportistaId: user.id },
      select: { litros: true, total: true, creadoEn: true },
    });
    const totalLitros = entregas.reduce((s, e) => s + e.litros, 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const ventasMes = entregas.filter(e => new Date(e.creadoEn) >= inicioMes).reduce((s, e) => s + e.total, 0);
    const totalVueltas = await akuosplashDb.akuoVuelta.count({ where: { transportistaId: user.id } });

    return NextResponse.json({
      usuario: {
        id: user.id, userId: user.id, nombre: user.nombre, email: user.email,
        telefono: user.telefono, role: user.rol, activo: user.activo,
      },
      camiones: vehiculos.map(v => ({
        id: v.id, nombre: `${v.marca || ""} ${v.modelo || ""}`.trim() || v.patente,
        patente: v.patente, capacidad: v.capacidadLitros, activo: v.activo,
      })),
      stats: { totalEntregas, totalLitros, totalVueltas, ventasMes },
      dueno: null,
    });
  }

  // Determinar plan activo + features
  let planInfo;
  if (previewPlan && user.rol === "superadmin") {
    const configs = await getPlanConfigs();
    const planId = normalizePlanId(previewPlan);
    planInfo = {
      planId,
      plan: configs[planId] || configs.gratis,
      planActivoDesde: null,
      planActivoHasta: null,
      estaActivo: true,
      esPreview: true,
    };
  } else {
    planInfo = await getPlanActivo(user.id);
  }

  return NextResponse.json({
    user: {
      id: user.id, userId: user.id, email: user.email, telefono: user.telefono,
      nombre: user.nombre, rol: user.rol, role: user.rol,
      aprobado: user.aprobado, plan: planInfo.planId, planActivoHasta: planInfo.planActivoHasta, avatarUrl: user.avatarUrl, activo: user.activo,
      // Flag para saber si el perfil está incompleto
      perfilIncompleto: user.rol === "cliente" && (!user.rut || !user.zonaId),
      // Campos de perfil de transportista (los usa BasicPanel para mostrar "Estado del registro")
      // Si el usuario es transportista, incluir los datos del perfil para que el frontend pueda validar completitud
      ...(user.rol === "transportista" || user.rol === "superadmin" ? {
        rut: user.rut,
        licenciaConducirUrl: user.licenciaConducirUrl,
        rutEmpresa: user.rutEmpresa,
        razonSocial: user.razonSocial,
        patenteVehiculo: user.patenteVehiculo,
        capacidadVehiculoKg: user.capacidadVehiculoKg,
        tipoVehiculo: user.tipoVehiculo,
        // Estado de aprobación (para mostrar en BasicPanel)
        estadoAprobacion: user.estadoAprobacion || "pendiente",
        estadoAprobacionNota: user.estadoAprobacionNota,
        estadoAprobacionActualizadoEn: user.estadoAprobacionActualizadoEn,
      } : {}),
      // Plan info (features + commission + deferral)
      planInfo: {
        planId: planInfo.planId,
        plan: planInfo.plan,
        planActivoDesde: planInfo.planActivoDesde,
        planActivoHasta: planInfo.planActivoHasta,
        estaActivo: planInfo.estaActivo,
        esPreview: planInfo.esPreview || false,
      },
    },
    hasUsers: true,
  });
}
