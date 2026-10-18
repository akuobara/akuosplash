import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getMpSubCreds } from "@/lib/akuosplash-plans";

// GET /api/akuosplash/subscription/mercadopago/sync
// Recarga el estado de la preapproval desde MP y actualiza la DB.
// Útil para el transportista que vuelve del redirect de MP y no ve el cambio reflejado.
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const u = await akuosplashDb.akuoUsuario.findUnique({
    where: { id: user.id },
    select: {
      mpSubPreapprovalId: true, mpSubPlanSolicitado: true, mpSubCiclo: true,
      mpSubStatus: true, plan: true, planActivoDesde: true, planActivoHasta: true,
    },
  });
  if (!u?.mpSubPreapprovalId) {
    return NextResponse.json({ ok: false, reason: "no_preapproval" });
  }

  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) return NextResponse.json({ ok: false, error: "MP Sub no configurado" }, { status: 500 });

  const apiBase = "https://api.mercadopago.com";
  const r = await fetch(`${apiBase}/preapproval/${u.mpSubPreapprovalId}`, {
    headers: { Authorization: `Bearer ${subCreds.accessToken}` },
  });
  if (!r.ok) return NextResponse.json({ ok: false, error: `MP ${r.status}` }, { status: 502 });
  const data = await r.json();

  const status: string = data.status;
  const updateData: any = { mpSubStatus: status };

  // Si pasó a authorized y el plan actual no es el solicitado → activar
  if (status === "authorized" && u.mpSubPlanSolicitado && u.plan !== u.mpSubPlanSolicitado) {
    const ahora = new Date();
    const fin = new Date(ahora);
    if (u.mpSubCiclo === "anual") fin.setFullYear(fin.getFullYear() + 1);
    else fin.setMonth(fin.getMonth() + 1);
    updateData.plan = u.mpSubPlanSolicitado;
    updateData.planActivoDesde = ahora;
    updateData.planActivoHasta = fin;
    updateData.mpSubAutorizadoEn = ahora;
    updateData.suscripcionActiva = true;
  }

  await akuosplashDb.akuoUsuario.update({ where: { id: user.id }, data: updateData });

  return NextResponse.json({ ok: true, status });
}
