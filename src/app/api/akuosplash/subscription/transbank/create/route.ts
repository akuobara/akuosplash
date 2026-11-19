import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { createTransaction, generateBuyOrder } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/create
// Inicia una transacción Webpay para el pago de una subscripción.
// Body: { plan: "premium" | "pro", ciclo: "mensual" | "anual" | "semanal" | "diario" }
// Devuelve: { token, url, buyOrder, amount }
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas pueden subscribirse" }, { status: 403 });
  }

  const body = await req.json();
  const plan = body.plan || "premium";
  const ciclo = body.ciclo || "mensual";
  if (plan !== "premium" && plan !== "pro") {
    return NextResponse.json({ error: "Plan inválido (debe ser premium o pro)" }, { status: 400 });
  }

  // Precio desde planConfigsJson (fuente real de precios de la app, igual que MP)
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) return NextResponse.json({ error: "Config no encontrada" }, { status: 500 });

  let amount: number;
  try {
    const configs = JSON.parse(config.planConfigsJson || "{}");
    const cfg = configs[plan];
    if (!cfg) throw new Error(`plan ${plan} no está en planConfigsJson`);
    amount = ciclo === "anual" ? cfg.precioAnual
      : ciclo === "semanal" ? cfg.precioSemanal
      : ciclo === "diario" ? cfg.precioDiario
      : cfg.precioMensual;
    if (!amount || amount <= 0) throw new Error(`precio ${ciclo} no configurado para ${plan}`);
  } catch (e: any) {
    return NextResponse.json({ error: `Precio no disponible para ${plan}/${ciclo}: ${e.message}` }, { status: 400 });
  }

  const buyOrder = generateBuyOrder(user.id);
  const sessionId = user.id;

  // URL de retorno: dominio real de la app (el env apunta a dominios viejos)
  const returnUrl = `https://akuosplash.cl/api/akuosplash/subscription/transbank/return`;

  try {
    const result = await createTransaction({
      buyOrder,
      sessionId,
      amount,
      returnUrl,
    });

    // Guardar la transacción pendiente en la DB para tracking
    await akuosplashDb.akuoUsuario.update({
      where: { id: user.id },
      data: {
        transbankBuyOrder: buyOrder,
        transbankTokenWs: result.token,
        transbankStatus: "INITIALIZED",
        transbankAmount: amount,
        transbankPlanSolicitado: plan,
        transbankCiclo: ciclo,
        transbankIniciadoEn: new Date(),
      },
    });

    return NextResponse.json({
      token: result.token,
      url: result.url,
      buyOrder,
      amount,
    });
  } catch (e: any) {
    console.error("[transbank create]", e);
    return NextResponse.json({ error: e.message || "No se pudo iniciar la transacción" }, { status: 500 });
  }
}
