import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns, getPlanConfigs, getMpSubCreds, PlanId } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/retry
// Permite al transportista reintentar el pago de su subscripción después de un fallo.
// - Si la preapproval estaba paused/cancelled/payment_failed, crea una nueva preapproval
// - El usuario es redirigido al init_point de MP para autorizarla
// Body: { plan: "premium" | "pro", ciclo: "mensual" | "anual" }
// Devuelve: { initPoint, preapprovalId }
export async function POST(req: NextRequest) {
  await ensureAkuoConfigColumns();
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json();
  const planRaw: string = body.plan || "premium";
  const cicloRaw: string = body.ciclo || "mensual";
  const ciclo: "mensual" | "anual" | "semanal" | "diario" =
    cicloRaw === "anual" ? "anual" : cicloRaw === "semanal" ? "semanal" : cicloRaw === "diario" ? "diario" : "mensual";

  // Cargar config + MP creds
  const configs = await getPlanConfigs();
  const planLookupKey = planRaw === "pago" ? "premium" : planRaw;
  const planCfg = (configs as any)[planLookupKey];
  if (!planCfg) return NextResponse.json({ error: `Plan '${planRaw}' no encontrado` }, { status: 400 });
  const planId = planLookupKey;
  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) {
    return NextResponse.json({ error: "MP Subscriptions no configurado" }, { status: 500 });
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.onrender.com";
  const amount = ciclo === "anual" ? planCfg.precioAnual
    : ciclo === "semanal" ? planCfg.precioSemanal
    : ciclo === "diario" ? planCfg.precioDiario
    : planCfg.precioMensual;
  const frequency = ciclo === "anual" ? 12 : ciclo === "semanal" ? 7 : 1;
  const frequencyType: "days" | "months" = (ciclo === "semanal" || ciclo === "diario") ? "days" : "months";

  // MP test user email (si está configurado)
  let mpPayerEmail = user.email || "";
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpTestUserEmail FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      user.id
    ).catch(() => []);
    if (Array.isArray(r) && r.length > 0 && r[0]?.mpTestUserEmail) {
      mpPayerEmail = r[0].mpTestUserEmail;
    }
  } catch {}

  // Crear preapproval_PLAN en MP (modelo actual — el inline queda con activation=true y botón gris).
  const mpBody: any = {
    reason: `AkuoSplash — Plan ${planCfg.nombre} (${ciclo}) — reintento`,
    auto_recurring: {
      frequency,
      frequency_type: frequencyType,
      transaction_amount: amount,
      currency_id: "CLP",
    },
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    external_reference: `akuo_sub:${user.id}:${planId}:${ciclo}`,
    payment_methods_allowed: {
      payment_type_id: ["credit_card"],
    },
  };

  try {
    const r = await fetch("https://api.mercadopago.com/preapproval_plan", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${subCreds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("[mp sub retry]", data);
      return NextResponse.json({
        error: data.message || data.error || `MP error ${r.status}`,
      }, { status: 500 });
    }

    // El plan devuelve init_point SIN activation=true.
    const initPoint = data.init_point;
    if (!initPoint) {
      return NextResponse.json({ error: "MP no devolvió init_point del plan", data }, { status: 500 });
    }

    // Guardamos el plan_id (temporal — el webhook lo reemplaza por el preapproval_id real).
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET
        mpSubPreapprovalId = ?,
        mpSubPlanSolicitado = ?,
        mpSubCiclo = ?,
        mpSubStatus = 'pending',
        mpSubIniciadoEn = ?,
        mpSubAmount = ?
       WHERE id = ?`,
      data.id, planId, ciclo, new Date().toISOString(), amount, user.id
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      initPoint,
      preapprovalId: data.id,
      amount,
      planId,
      ciclo,
    });
  } catch (e: any) {
    console.error("[mp sub retry exception]", e);
    return NextResponse.json({ error: e?.message || "Error al crear nueva preapproval" }, { status: 500 });
  }
}
