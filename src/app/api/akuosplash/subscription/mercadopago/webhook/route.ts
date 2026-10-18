import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { getMpSubCreds } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/mercadopago/webhook
// Recibe notificaciones de MercadoPago sobre cambios de estado de preapprovals.
// MP envía: { type: "subscription_preapproval", data: { id: "..." } }
// Consultamos el estado real a MP y actualizamos la DB.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type;
    const dataId = body.data?.id || body.id;

    // MP también manda notificaciones de payment — las ignoramos acá
    if (type !== "subscription_preapproval" && type !== "preapproval") {
      return NextResponse.json({ ok: true, ignored: true, type });
    }

    if (!dataId) return NextResponse.json({ ok: true, ignored: true, noId: true });

    // Usar la cuenta MP de subscriptions (no la de split)
    const subCreds = await getMpSubCreds();
    if (!subCreds.accessToken) return NextResponse.json({ ok: false, error: "MP Sub no configurado" }, { status: 500 });

    const apiBase = "https://api.mercadopago.com";
    const r = await fetch(`${apiBase}/preapproval/${dataId}`, {
      headers: { Authorization: `Bearer ${subCreds.accessToken}` },
    });
    if (!r.ok) {
      console.error("[mp sub webhook] fetch failed", r.status);
      return NextResponse.json({ ok: false, error: "MP fetch failed" }, { status: 502 });
    }
    const data = await r.json();

    // external_reference formato: "akuo_sub:<userId>:<planId>:<ciclo>"
    const extRef: string = data.external_reference || "";
    const parts = extRef.split(":");
    if (parts.length < 4 || parts[0] !== "akuo_sub") {
      return NextResponse.json({ ok: true, ignored: true, reason: "external_ref inválido" });
    }
    const userId = parts[1];
    const planId = parts[2];
    const ciclo = parts[3];

    const status: string = data.status; // pending | authorized | paused | cancelled
    const amount: number | undefined = data.auto_recurring?.transaction_amount;

    // Actualizar el usuario con el estado de la preapproval
    const updateData: any = {
      mpSubStatus: status,
      mpSubPreapprovalId: data.id,
    };
    if (amount !== undefined) updateData.mpSubAmount = amount;

    // Si está autorizada, activar el plan
    if (status === "authorized") {
      const ahora = new Date();
      const inicio = ahora;
      const fin = new Date(ahora);
      if (ciclo === "anual") {
        fin.setFullYear(fin.getFullYear() + 1);
      } else {
        fin.setMonth(fin.getMonth() + 1);
      }
      updateData.plan = planId;
      updateData.planActivoDesde = inicio;
      updateData.planActivoHasta = fin;
      updateData.mpSubAutorizadoEn = ahora;
      updateData.suscripcionActiva = true;
    } else if (status === "cancelled" || status === "paused") {
      // No desactivamos inmediatamente el plan, dejamos que venza naturalmente
      // El transportista puede seguir usando el plan hasta que planActivoHasta pase
      updateData.suscripcionActiva = false;
    }

    await akuosplashDb.akuoUsuario.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({ ok: true, status, userId, planId, ciclo });
  } catch (e: any) {
    console.error("[mp sub webhook exception]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// MP manda un GET cuando se registra la URL para verificar
export async function GET() {
  return NextResponse.json({ ok: true });
}
