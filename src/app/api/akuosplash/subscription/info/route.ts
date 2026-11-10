import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPlanConfigs, PLAN_ORDER } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/subscription/info
// Devuelve el estado de subscripción del usuario logueado (transportista) + configs de los 3 planes.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Recargar usuario para tener campos de transbank + mpSub*
  const u = await akuosplashDb.akuoUsuario.findUnique({
    where: { id: user.id },
    select: {
      plan: true,
      planActivoDesde: true,
      planActivoHasta: true,
      transbankBuyOrder: true,
      transbankStatus: true,
      transbankAmount: true,
      transbankPlanSolicitado: true,
      transbankCiclo: true,
      transbankIniciadoEn: true,
      transbankAutorizadoEn: true,
      transbankAuthorizationCode: true,
      mpSubPreapprovalId: true,
      mpSubPlanSolicitado: true,
      mpSubCiclo: true,
      mpSubStatus: true,
      mpSubIniciadoEn: true,
      mpSubAutorizadoEn: true,
      mpSubAmount: true,
    },
  });

  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Todos los planes disponibles (para que el transportista pueda ver y elegir)
  const configs = await getPlanConfigs();

  // Construir orden dinámico: PLAN_ORDER + planes custom de la DB
  const ordenDinamico: string[] = [...PLAN_ORDER];
  try {
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const r = await client.execute("SELECT id FROM AkuoPlanConfig WHERE activo = 1 AND id NOT IN ('gratis','premium','pro') ORDER BY orden ASC");
    for (const row of r.rows) {
      const id = (row as any).id;
      if (!ordenDinamico.includes(id)) ordenDinamico.push(id);
    }
  } catch {}

  return NextResponse.json({
    subscripcion: {
      plan: u.plan,
      planActivoDesde: u.planActivoDesde,
      planActivoHasta: u.planActivoHasta,
      transbankBuyOrder: u.transbankBuyOrder,
      transbankStatus: u.transbankStatus,
      transbankAmount: u.transbankAmount,
      transbankPlanSolicitado: u.transbankPlanSolicitado,
      transbankCiclo: u.transbankCiclo,
      transbankIniciadoEn: u.transbankIniciadoEn,
      transbankAutorizadoEn: u.transbankAutorizadoEn,
      transbankAuthorizationCode: u.transbankAuthorizationCode,
      mpSubPreapprovalId: u.mpSubPreapprovalId,
      mpSubPlanSolicitado: u.mpSubPlanSolicitado,
      mpSubCiclo: u.mpSubCiclo,
      mpSubStatus: u.mpSubStatus,
      mpSubIniciadoEn: u.mpSubIniciadoEn,
      mpSubAutorizadoEn: u.mpSubAutorizadoEn,
      mpSubAmount: u.mpSubAmount,
    },
    planes: configs,
    orden: ordenDinamico,
  });
}
