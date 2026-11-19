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

  // El mpSubPreapprovalId guardado por /create (camino producción) es el PLAN_ID,
  // no el preapproval_id real (ese lo crea MP cuando el payer paga, y solo el webhook
  // lo entregaba antes). Si el webhook no está registrado, la DB nunca recibe el id real
  // y el GET /preapproval/<plan_id> de abajo daba 404 → el plan nunca se activaba.
  //
  // Fix: primero probar GET directo (sirve si ya es un preapproval_id real, p.ej. tras
  // webhook). Si falla (es plan_id), buscar las preapprovals de ese plan y tomar la
  // authorized. search?preapproval_plan_id=<id> es instantáneo (sin lag de índice).
  let data: any = null;
  const direct = await fetch(`${apiBase}/preapproval/${u.mpSubPreapprovalId}`, {
    headers: { Authorization: `Bearer ${subCreds.accessToken}` },
  });
  if (direct.ok) {
    data = await direct.json();
  } else if (direct.status === 404) {
    // mpSubPreapprovalId es un plan_id → buscar la preapproval real del plan
    const s = await fetch(`${apiBase}/preapproval/search?preapproval_plan_id=${u.mpSubPreapprovalId}`, {
      headers: { Authorization: `Bearer ${subCreds.accessToken}` },
    });
    if (!s.ok) return NextResponse.json({ ok: false, error: `MP search ${s.status}` }, { status: 502 });
    const sd = await s.json();
    const results = sd.results || sd.elements || [];
    // Preferir la authorized; si no hay, la más reciente
    data = results.find((p: any) => p.status === "authorized") || results[0] || null;
    if (!data) return NextResponse.json({ ok: false, reason: "no_preapproval_for_plan" });
  } else {
    return NextResponse.json({ ok: false, error: `MP ${direct.status}` }, { status: 502 });
  }

  const status: string = data.status;
  const updateData: any = { mpSubStatus: status };
  // Si encontramos el preapproval_id real (distinto del plan_id guardado), actualizarlo
  if (data.id && data.id !== u.mpSubPreapprovalId) {
    updateData.mpSubPreapprovalId = data.id;
  }

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
