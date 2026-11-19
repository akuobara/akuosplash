import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { authorize, generateBuyOrder, generateChildBuyOrder } from "@/lib/akuosplash-transbank";
import { getPlanConfigs } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/transbank/oneclick/cron
// Cobro recurrente: busca usuarios con tbkSubscriptionActive=1 cuyo plan venció
// (planActivoHasta <= ahora) y les cobra con la tarjeta inscripta.
// Protegido por header x-cron-secret (debe matchear CRON_SECRET env var).
// Programar con un scheduler externo (Render cron job / cron-job.org) que lo llame 1 vez por día.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const configs = await getPlanConfigs();
  const ahora = new Date();

  // Usuarios con suscripción activa cuyo plan venció
  const vencidos = await akuosplashDb.akuoUsuario.findMany({
    where: {
      tbkSubscriptionActive: true,
      tbkUser: { not: null },
      tbkUsername: { not: null },
      planActivoHasta: { lte: ahora },
      plan: { in: ["premium", "pro"] },
    },
    take: 100,
  });

  const resultados: { userId: string; ok: boolean; error?: string; plan?: string }[] = [];

  for (const u of vencidos) {
    const plan = u.plan as "premium" | "pro";
    const cfg = (configs as any)?.[plan];
    const amount = cfg?.precioMensual;
    if (!amount || amount <= 0) {
      resultados.push({ userId: u.id, ok: false, error: `precio no configurado para ${plan}` });
      continue;
    }
    const buyOrder = generateBuyOrder(u.id);
    const childBuyOrder = generateChildBuyOrder(buyOrder);
    try {
      const r = await authorize({
        username: u.tbkUsername!,
        tbkUser: u.tbkUser!,
        buyOrder,
        childBuyOrder,
        amount,
      });
      if (r.ok) {
        const hasta = new Date(ahora);
        hasta.setMonth(hasta.getMonth() + 1);
        await akuosplashDb.akuoUsuario.update({
          where: { id: u.id },
          data: {
            planActivoDesde: ahora,
            planActivoHasta: hasta,
            suscripcionFin: hasta,
            tbkLastCobroBuyOrder: buyOrder,
            tbkLastCobroEn: ahora,
            tbkLastCobroAuthCode: r.authorizationCode,
            transbankStatus: "AUTHORIZED",
          },
        });
        resultados.push({ userId: u.id, ok: true, plan });
      } else {
        // Cargo fallido — marcar suscripción como problemática pero no desactivar (reintenta siguiente día)
        await akuosplashDb.akuoUsuario.update({
          where: { id: u.id },
          data: { transbankStatus: `COBRO_FAIL_${r.responseCode}` },
        }).catch(() => {});
        resultados.push({ userId: u.id, ok: false, error: `response_code ${r.responseCode}`, plan });
      }
    } catch (e: any) {
      resultados.push({ userId: u.id, ok: false, error: e.message, plan });
    }
  }

  return NextResponse.json({
    procesados: vencidos.length,
    ok: resultados.filter(r => r.ok).length,
    fallidos: resultados.filter(r => !r.ok).length,
    resultados,
  });
}
