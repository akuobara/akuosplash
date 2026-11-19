import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { authorize, generateBuyOrder, generateChildBuyOrder } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/oneclick/authorize
// Cobra con la tarjeta inscripta (tbkUser) y activa el plan.
// Body: { plan: "premium" | "pro", ciclo: "mensual" (default) }
// Requiere tarjeta inscripta (tbkUser presente).
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Recargar usuario para tener tbkUser + tbkUsername
  const u = await akuosplashDb.akuoUsuario.findUnique({ where: { id: user.id } });
  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (!u.tbkUser) {
    return NextResponse.json({ error: "No tienes tarjeta inscripta. Inscribí una primero." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = body.plan || "premium";
  const ciclo = body.ciclo || "mensual";
  if (plan !== "premium" && plan !== "pro") {
    return NextResponse.json({ error: "Plan inválido (premium o pro)" }, { status: 400 });
  }

  // Precio desde planConfigsJson
  const config = await akuosplashDb.akuoConfig.findFirst();
  if (!config) return NextResponse.json({ error: "Config no encontrada" }, { status: 500 });

  let amount: number;
  try {
    const configs = JSON.parse(config.planConfigsJson || "{}");
    const cfg = configs[plan];
    if (!cfg) throw new Error(`plan ${plan} no en planConfigsJson`);
    amount = ciclo === "anual" ? cfg.precioAnual : ciclo === "semanal" ? cfg.precioSemanal : ciclo === "diario" ? cfg.precioDiario : cfg.precioMensual;
    if (!amount || amount <= 0) throw new Error(`precio ${ciclo} no configurado para ${plan}`);
  } catch (e: any) {
    return NextResponse.json({ error: `Precio no disponible: ${e.message}` }, { status: 400 });
  }

  const buyOrder = generateBuyOrder(user.id);
  const childBuyOrder = generateChildBuyOrder(buyOrder);

  try {
    const result = await authorize({
      username: u.tbkUsername!,
      tbkUser: u.tbkUser!,
      buyOrder,
      childBuyOrder,
      amount,
    });

    if (result.ok) {
      // Cargo exitoso — activar el plan
      const ahora = new Date();
      const hasta = new Date(ahora);
      if (ciclo === "anual") hasta.setFullYear(hasta.getFullYear() + 1);
      else hasta.setMonth(hasta.getMonth() + 1);

      await akuosplashDb.akuoUsuario.update({
        where: { id: user.id },
        data: {
          plan,
          planActivoDesde: ahora,
          planActivoHasta: hasta,
          suscripcionActiva: true,
          suscripcionInicio: ahora,
          suscripcionFin: hasta,
          tbkSubscriptionActive: true,
          tbkLastCobroBuyOrder: buyOrder,
          tbkLastCobroEn: ahora,
          tbkLastCobroAuthCode: result.authorizationCode,
          transbankStatus: "AUTHORIZED",
          transbankAuthorizationCode: result.authorizationCode,
          transbankAmount: amount,
          transbankPlanSolicitado: plan,
          transbankCiclo: ciclo,
          transbankAutorizadoEn: ahora,
        },
      });

      return NextResponse.json({
        ok: true,
        authorizationCode: result.authorizationCode,
        buyOrder,
        amount,
        plan,
        planActivoHasta: hasta,
      });
    } else {
      // Cargo rechazado
      await akuosplashDb.akuoUsuario.update({
        where: { id: user.id },
        data: { transbankStatus: "REJECTED" },
      }).catch(() => {});
      return NextResponse.json({
        ok: false,
        error: "Cargo rechazado por Transbank",
        responseCode: result.responseCode,
      }, { status: 402 });
    }
  } catch (e: any) {
    console.error("[oneclick authorize]", e);
    await akuosplashDb.akuoUsuario.update({
      where: { id: user.id },
      data: { transbankStatus: "ERROR" },
    }).catch(() => {});
    return NextResponse.json({ error: e.message || "No se pudo hacer el cargo" }, { status: 500 });
  }
}
