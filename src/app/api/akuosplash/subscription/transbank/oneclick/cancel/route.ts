import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { refund, generateChildBuyOrder } from "@/lib/akuosplash-transbank";

// POST /api/akuosplash/subscription/transbank/oneclick/cancel
// Cancela la suscripción recurrente:
//  1. Reembolsa (reverse) el último cargo confirmado — el usuario recupera su dinero.
//  2. Desactiva el plan (vuelve a gratis) y apaga el cobro recurrente.
// Body: { } (no requiere params; usa el último cargo del usuario)
export async function POST(_req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const u = await akuosplashDb.akuoUsuario.findUnique({ where: { id: user.id } });
  if (!u) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  if (!u.tbkLastCobroBuyOrder) {
    return NextResponse.json({ error: "No hay cargo previo que reembolsar" }, { status: 400 });
  }

  const childBuyOrder = generateChildBuyOrder(u.tbkLastCobroBuyOrder);
  const amount = u.transbankAmount || u.tbkLastCobroBuyOrder ? (u.transbankAmount || 0) : 0;
  if (!amount) {
    return NextResponse.json({ error: "Monto del cargo original desconocido" }, { status: 400 });
  }

  let refundResult;
  try {
    refundResult = await refund({
      buyOrder: u.tbkLastCobroBuyOrder,
      childBuyOrder,
      amount,
    });
  } catch (e: any) {
    console.error("[oneclick cancel refund]", e);
    // Si el reembolso falla (ej. ya reembolsado o fuera de ventana), igual desactivamos el plan
    refundResult = { ok: false, error: e.message };
  }

  // Desactivar el plan y apagar el cobro recurrente, sin importar si el refund falló
  await akuosplashDb.akuoUsuario.update({
    where: { id: user.id },
    data: {
      plan: "gratis",
      suscripcionActiva: false,
      tbkSubscriptionActive: false,
      transbankStatus: refundResult?.ok ? "NULLIFIED" : "CANCEL_REFUND_FAIL",
    },
  });

  return NextResponse.json({
    ok: true,
    refunded: refundResult?.ok ?? false,
    refundDetail: refundResult,
    message: refundResult?.ok
      ? "Suscripción cancelada y último cargo reembolsado."
      : "Suscripción cancelada. El reembolso falló (puede estar fuera de ventana o ya reembolsado).",
  });
}
