import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/admin/subscriptions
// Lista todas las subscripciones de transportistas con filtros + stats.
// Query params: ?estado=authorized&plan=pro&page=1&pageSize=20
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();

  const url = new URL(req.url);
  const estadoFiltro = url.searchParams.get("estado"); // authorized | paused | cancelled | suspended | payment_failed | pending | all
  const planFiltro = url.searchParams.get("plan"); // gratis | premium | pro | all
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50");

  // Construir WHERE clause dinámica
  const where: string[] = ["u.rol = 'transportista'"];
  const params: any[] = [];
  if (estadoFiltro && estadoFiltro !== "all") {
    if (estadoFiltro === "suspended") {
      where.push("u.mpSubSuspended = 1");
    } else if (estadoFiltro === "active") {
      // Subscripción activa (no suspendida, no cancelled)
      where.push("u.mpSubStatus IN ('authorized', 'pending')");
      where.push("(u.mpSubSuspended = 0 OR u.mpSubSuspended IS NULL)");
    } else {
      where.push("u.mpSubStatus = ?");
      params.push(estadoFiltro);
    }
  }
  if (planFiltro && planFiltro !== "all") {
    where.push("u.plan = ?");
    params.push(planFiltro);
  }

  const whereSql = where.join(" AND ");
  const offset = (page - 1) * pageSize;

  // Consultar subscripciones paginadas
  const subsQuery = `
    SELECT u.id, u.email, u.nombre, u.plan, u.planActivoDesde, u.planActivoHasta,
           u.mpSubPreapprovalId, u.mpSubPlanSolicitado, u.mpSubCiclo, u.mpSubStatus,
           u.mpSubIniciadoEn, u.mpSubAutorizadoEn, u.mpSubAmount,
           u.mpSubSuspended, u.mpSubSuspendedEn, u.mpSubSuspendedRazon,
           u.suscripcionActiva
    FROM AkuoUsuario u
    WHERE ${whereSql}
    ORDER BY (u.planActivoHasta IS NULL), u.planActivoHasta DESC, u.creadoEn DESC
    LIMIT ? OFFSET ?
  `;
  const subsParams = [...params, pageSize, offset];

  let subs: any[] = [];
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(subsQuery, ...subsParams);
    subs = Array.isArray(r) ? r : [];
  } catch (e: any) {
    console.error("[admin/subscriptions] query failed:", e?.message);
  }

  // Stats globales (sin filtros)
  const statsQuery = `
    SELECT
      COUNT(CASE WHEN u.plan = 'premium' THEN 1 END) AS premiumCount,
      COUNT(CASE WHEN u.plan = 'pro' THEN 1 END) AS proCount,
      COUNT(CASE WHEN u.plan = 'gratis' OR u.plan IS NULL THEN 1 END) AS gratisCount,
      COUNT(CASE WHEN u.mpSubStatus = 'authorized' THEN 1 END) AS authorizedCount,
      COUNT(CASE WHEN u.mpSubStatus = 'pending' THEN 1 END) AS pendingCount,
      COUNT(CASE WHEN u.mpSubStatus = 'paused' THEN 1 END) AS pausedCount,
      COUNT(CASE WHEN u.mpSubStatus = 'cancelled' THEN 1 END) AS cancelledCount,
      COUNT(CASE WHEN u.mpSubStatus = 'payment_failed' THEN 1 END) AS paymentFailedCount,
      COUNT(CASE WHEN u.mpSubSuspended = 1 THEN 1 END) AS suspendedCount,
      COUNT(CASE WHEN u.planActivoHasta IS NOT NULL AND u.planActivoHasta < ? THEN 1 END) AS expiredCount,
      COUNT(CASE WHEN u.plan != 'gratis' AND u.plan IS NOT NULL AND (u.planActivoHasta IS NULL OR u.planActivoHasta >= ?) THEN 1 END) AS activePlansCount,
      COALESCE(SUM(CASE WHEN u.mpSubAmount IS NOT NULL THEN u.mpSubAmount ELSE 0 END), 0) AS totalMRR
    FROM AkuoUsuario u
    WHERE u.rol = 'transportista'
  `;
  const ahoraIso = new Date().toISOString();
  let stats: any = {};
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(statsQuery, ahoraIso, ahoraIso);
    if (Array.isArray(r) && r.length > 0) stats = r[0];
  } catch (e: any) {
    console.error("[admin/subscriptions] stats query failed:", e?.message);
  }

  // Contar total para paginación
  const countQuery = `SELECT COUNT(*) as total FROM AkuoUsuario u WHERE ${whereSql}`;
  let total = 0;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(countQuery, ...params);
    if (Array.isArray(r) && r.length > 0) total = r[0].total || 0;
  } catch {}

  return NextResponse.json({
    subscriptions: subs.map((s: any) => ({
      id: s.id,
      email: s.email,
      nombre: s.nombre,
      plan: s.plan,
      planActivoDesde: s.planActivoDesde,
      planActivoHasta: s.planActivoHasta,
      mpSubPreapprovalId: s.mpSubPreapprovalId,
      mpSubPlanSolicitado: s.mpSubPlanSolicitado,
      mpSubCiclo: s.mpSubCiclo,
      mpSubStatus: s.mpSubStatus,
      mpSubIniciadoEn: s.mpSubIniciadoEn,
      mpSubAutorizadoEn: s.mpSubAutorizadoEn,
      mpSubAmount: s.mpSubAmount,
      mpSubSuspended: !!s.mpSubSuspended,
      mpSubSuspendedEn: s.mpSubSuspendedEn,
      mpSubSuspendedRazon: s.mpSubSuspendedRazon,
      suscripcionActiva: !!s.suscripcionActiva,
    })),
    stats: {
      premiumCount: stats.premiumCount || 0,
      proCount: stats.proCount || 0,
      gratisCount: stats.gratisCount || 0,
      authorizedCount: stats.authorizedCount || 0,
      pendingCount: stats.pendingCount || 0,
      pausedCount: stats.pausedCount || 0,
      cancelledCount: stats.cancelledCount || 0,
      paymentFailedCount: stats.paymentFailedCount || 0,
      suspendedCount: stats.suspendedCount || 0,
      expiredCount: stats.expiredCount || 0,
      activePlansCount: stats.activePlansCount || 0,
      // MRR (Monthly Recurring Revenue) — suma de subscripciones mensuales equivalentes
      totalMRR: stats.totalMRR || 0,
    },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
