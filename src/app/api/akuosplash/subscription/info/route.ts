import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/subscription/info
// Devuelve el estado de subscripción del usuario logueado (transportista).
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Recargar usuario para tener campos de transbank
  const u = await akuosplashDb.akuoUsuario.findUnique({
    where: { id: user.id },
    select: {
      plan: true,
      planActivoDesde: true,
      planActivoHasta: true,
      transbankBuyOrder: true,
      transbankTokenWs: true,
      transbankStatus: true,
      transbankAmount: true,
      transbankPlanSolicitado: true,
      transbankCiclo: true,
      transbankIniciadoEn: true,
      transbankAutorizadoEn: true,
      transbankAuthorizationCode: true,
    },
  });

  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

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
    },
  });
}
