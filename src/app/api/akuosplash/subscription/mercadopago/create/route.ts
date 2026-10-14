import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPlanConfigs, PlanId, PLAN_ORDER } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/mercadopago/create
// Crea una preapproval (subscripción recurrente) en MercadoPago para el plan seleccionado.
// Body: { plan: "pago" | "pro", ciclo: "mensual" | "anual" }
// Devuelve: { initPoint, preapprovalId }
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json();
  const planId: PlanId = body.plan === "pro" ? "pro" : "pago";
  const ciclo: "mensual" | "anual" = body.ciclo === "anual" ? "anual" : "mensual";

  // Cargar config de plan + MP creds
  const configs = await getPlanConfigs();
  const planCfg = configs[planId];
  const mpConfig = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
  const accessToken = mpConfig?.mpAccessToken || process.env.AKUO_MP_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MercadoPago no configurado. Pedile al superadmin que lo configure." }, { status: 500 });
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://my-project-azure-five-82.vercel.app";
  const amount = ciclo === "anual" ? planCfg.precioAnual : planCfg.precioMensual;
  const frequency = ciclo === "anual" ? 12 : 1;
  const frequencyType = ciclo === "anual" ? "months" : "months";

  // Crear preapproval en MP
  // https://www.mercadopago.cl/developers/en/docs/subscriptions/api/preapprovals
  const mpBody: any = {
    reason: `AkuoSplash — Plan ${planCfg.nombre} (${ciclo})`,
    auto_recurring: {
      frequency,
      frequency_type: frequencyType,
      transaction_amount: amount,
      currency_id: "CLP",
    },
    payer_email: user.email,
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    status: "pending",
    external_reference: `akuo_sub:${user.id}:${planId}:${ciclo}`,
    notification_url: `${APP_URL}/api/akuosplash/subscription/mercadopago/webhook`,
  };

  const sandbox = mpConfig?.mpSandbox ?? true;
  const apiBase = sandbox ? "https://api.mercadopago.com" : "https://api.mercadopago.com";

  try {
    const res = await fetch(`${apiBase}/preapproval`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[mp sub create]", data);
      const msg = data.message || data.error || `MP error ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const initPoint = data.init_point || (sandbox ? data.sandbox_init_point : data.init_point);
    if (!initPoint) {
      return NextResponse.json({ error: "MP no devolvió init_point", data }, { status: 500 });
    }

    // Guardar la preapproval pendiente en la DB
    await akuosplashDb.akuoUsuario.update({
      where: { id: user.id },
      data: {
        mpSubPreapprovalId: data.id,
        mpSubPlanSolicitado: planId,
        mpSubCiclo: ciclo,
        mpSubStatus: "pending",
        mpSubIniciadoEn: new Date(),
        mpSubAmount: amount,
      },
    });

    return NextResponse.json({
      initPoint,
      preapprovalId: data.id,
      amount,
      planId,
      ciclo,
    });
  } catch (e: any) {
    console.error("[mp sub create exception]", e);
    return NextResponse.json({ error: e.message || "Error al crear subscripción" }, { status: 500 });
  }
}
