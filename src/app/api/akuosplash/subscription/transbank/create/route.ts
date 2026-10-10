import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { createTransaction, generateBuyOrder } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/create
// Inicia una transacción Webpay para el pago de una subscripción.
// Body: { plan: "pro" | "enterprise", ciclo: "mensual" | "anual" }
// Devuelve: { token, url, buyOrder }
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista") {
    return NextResponse.json({ error: "Solo transportistas pueden subscribirse" }, { status: 403 });
  }

  const body = await req.json();
  const plan = body.plan || "pro";
  const ciclo = body.ciclo || "mensual";
  if (plan !== "pro" && plan !== "enterprise") {
    return NextResponse.json({ error: "Plan inválido (debe ser pro o enterprise)" }, { status: 400 });
  }

  // Cargar config para precios
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) return NextResponse.json({ error: "Config no encontrada" }, { status: 500 });

  const precioPlan = plan === "pro" ? config.precioPlanPro : config.precioPlanEnterprise;
  const amount = ciclo === "anual" ? precioPlan * 10 : precioPlan; // anual = 10 meses (2 gratis)

  const buyOrder = generateBuyOrder(user.id);
  const sessionId = user.id;

  // Determinar la URL de retorno (debe ser absoluta y pública)
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://my-project-azure-five-82.vercel.app"}/api/akuosplash/subscription/transbank/return`;

  try {
    const result = await createTransaction({
      buyOrder,
      sessionId,
      amount,
      returnUrl,
    });

    // Guardar la transacción pendiente en la DB para tracking
    // Usamos AkuoUsuario.transbankBuyOrder (campo nuevo)
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
