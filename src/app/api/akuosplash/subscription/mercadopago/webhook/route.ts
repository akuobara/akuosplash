import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { getMpSubCreds } from "@/lib/akuosplash-plans";
import { akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/subscription/mercadopago/webhook
// Recibe notificaciones de MercadoPago sobre:
//   1. Cambios de estado de preapprovals (subscription_preapproval) — authorized, paused, cancelled
//   2. Pagos recurrentes (payment) — approved, rejected, pending
//
// Para cada caso, actualiza la DB y manda notificación al transportista.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = body.type;
    const dataId = body.data?.id || body.id;

    // === TIPO 1: Cambios de estado de preapproval ===
    if (type === "subscription_preapproval" || type === "preapproval") {
      return await handlePreapprovalWebhook(dataId);
    }

    // === TIPO 2: Notificaciones de payment (pagos recurrentes) ===
    if (type === "payment" || type === "merchant_order") {
      return await handlePaymentWebhook(dataId, body);
    }

    // Tipo desconocido — ignorar
    return NextResponse.json({ ok: true, ignored: true, type });
  } catch (e: any) {
    console.error("[mp sub webhook exception]", e);
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

// Maneja webhook de cambio de estado de preapproval (authorized, paused, cancelled)
async function handlePreapprovalWebhook(dataId: string | undefined) {
  if (!dataId) return NextResponse.json({ ok: true, ignored: true, noId: true });

  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) return NextResponse.json({ ok: false, error: "MP Sub no configurado" }, { status: 500 });

  const apiBase = "https://api.mercadopago.com";
  const r = await fetch(`${apiBase}/preapproval/${dataId}`, {
    headers: { Authorization: `Bearer ${subCreds.accessToken}` },
  });
  if (!r.ok) {
    console.error("[mp preapproval webhook] fetch failed", r.status);
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

  // Caso 1: authorized → activar el plan
  if (status === "authorized") {
    const ahora = new Date();
    const fin = new Date(ahora);
    if (ciclo === "anual") {
      fin.setFullYear(fin.getFullYear() + 1);
    } else {
      fin.setMonth(fin.getMonth() + 1);
    }
    updateData.plan = planId;
    updateData.planActivoDesde = ahora;
    updateData.planActivoHasta = fin;
    updateData.mpSubAutorizadoEn = ahora;
    updateData.suscripcionActiva = true;

    // Notificar al transportista
    await akuoNotificar(
      userId,
      "sub_activada",
      "✅ Subscripción activada",
      `Tu plan ${planId} está activo hasta el ${fin.toLocaleDateString("es-CL")}.`,
      "/akuosplash/transportista?tab=subscripcion"
    );
  }

  // Caso 2: paused → subscripción pausada (MP no pudo cobrar)
  else if (status === "paused") {
    updateData.suscripcionActiva = false;
    // No desactivamos el plan inmediatamente — el transportista sigue teniendo acceso
    // hasta que planActivoHasta pase. Esto le da un periodo de gracia para arreglar el pago.

    await akuoNotificar(
      userId,
      "sub_pausada",
      "⚠️ Pago de subscripción pausado",
      `MP no pudo cobrar tu subscripción del plan ${planId}. Tenés acceso hasta el vencimiento (${await getPlanVencimiento(userId)}). Pasá a revisar tu método de pago en MP.`,
      "/akuosplash/transportista?tab=subscripcion"
    );
  }

  // Caso 3: cancelled → subscripción cancelada por el usuario o por MP
  else if (status === "cancelled") {
    updateData.suscripcionActiva = false;
    // El plan sigue activo hasta planActivoHasta (periodo de gracia)

    await akuoNotificar(
      userId,
      "sub_cancelada",
      "🛑 Subscripción cancelada",
      `Tu subscripción al plan ${planId} fue cancelada. Tenés acceso hasta el ${await getPlanVencimiento(userId)}. Después pasarás al plan Gratis.`,
      "/akuosplash/transportista?tab=subscripcion"
    );
  }

  await akuosplashDb.akuoUsuario.update({
    where: { id: userId },
    data: updateData,
  }).catch(async (e: any) => {
    // Si falla Prisma (columnas nuevas), usar raw SQL
    if (String(e?.message || "").includes("no such column")) {
      await updateViaRawSql(userId, updateData);
    } else {
      throw e;
    }
  });

  return NextResponse.json({ ok: true, status, userId, planId, ciclo });
}

// Maneja webhook de payment — pagos recurrentes de subscripción
async function handlePaymentWebhook(dataId: string | undefined, body: any) {
  if (!dataId) return NextResponse.json({ ok: true, ignored: true, noId: true });

  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) return NextResponse.json({ ok: false, error: "MP Sub no configurado" }, { status: 500 });

  // Consultar el payment real a MP
  const apiBase = "https://api.mercadopago.com";
  const r = await fetch(`${apiBase}/v1/payments/${dataId}`, {
    headers: { Authorization: `Bearer ${subCreds.accessToken}` },
  });
  if (!r.ok) {
    console.error("[mp payment webhook] fetch failed", r.status);
    return NextResponse.json({ ok: false, error: "MP fetch failed" }, { status: 502 });
  }
  const data = await r.json();

  // El external_reference del payment indica a qué subscripción pertenece
  // Formato: "akuo_sub:<userId>:<planId>:<ciclo>" (igual que la preapproval)
  // O puede venir en data.metadata.preapproval_id
  const extRef = data.external_reference || "";
  const parts = extRef.split(":");
  if (parts.length < 4 || parts[0] !== "akuo_sub") {
    // No es un payment de subscripción nuestra — podría ser de marketplace split
    return NextResponse.json({ ok: true, ignored: true, reason: "external_ref no es de subscripción" });
  }
  const userId = parts[1];
  const planId = parts[2];
  const ciclo = parts[3];

  const status = data.status; // approved | rejected | pending | in_process
  const statusDetail = data.status_detail;
  const amount = data.transaction_amount;

  // === Pago recurrente APROBADO → extender planActivoHasta al próximo periodo ===
  if (status === "approved") {
    // Leer el planActivoHasta actual — si ya pasó o está cercano, extender desde hoy
    // Si está en el futuro, extender desde ahí (acumular)
    const user: any = await akuosplashDb.akuoUsuario.findUnique({
      where: { id: userId },
      select: { planActivoHasta: true, planActivoDesde: true, plan: true, mpSubStatus: true, email: true, nombre: true },
    }).catch(async () => {
      // Fallback raw SQL si hay problema de columnas
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT plan, planActivoDesde, planActivoHasta, mpSubStatus FROM AkuoUsuario WHERE id = ? LIMIT 1`,
        userId
      ).catch(() => []);
      return Array.isArray(r) && r.length > 0 ? r[0] : null;
    });

    if (!user) return NextResponse.json({ ok: true, ignored: true, reason: "user not found" });

    const ahora = new Date();
    const baseDate = user.planActivoHasta && new Date(user.planActivoHasta) > ahora
      ? new Date(user.planActivoHasta)  // extender desde la fecha actual
      : ahora;  // ya venció → empezar desde hoy
    const nuevoFin = new Date(baseDate);
    if (ciclo === "anual") {
      nuevoFin.setFullYear(nuevoFin.getFullYear() + 1);
    } else {
      nuevoFin.setMonth(nuevoFin.getMonth() + 1);
    }

    // Update via raw SQL (Prisma puede fallar con columnas nuevas)
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET planActivoHasta = ?, mpSubStatus = 'authorized', suscripcionActiva = 1, mpSubAutorizadoEn = ? WHERE id = ?`,
      nuevoFin.toISOString(), ahora.toISOString(), userId
    ).catch(() => {});

    await akuoNotificar(
      userId,
      "pago_recurrente_ok",
      "✅ Pago recibido",
      `Tu subscripción al plan ${planId} fue cobrada con éxito. Plan extendido hasta el ${nuevoFin.toLocaleDateString("es-CL")}.`,
      "/akuosplash/transportista?tab=subscripcion"
    );

    return NextResponse.json({
      ok: true,
      event: "pago_recurrente_approved",
      userId, planId, ciclo, amount,
      nuevoFin: nuevoFin.toISOString(),
    });
  }

  // === Pago recurrente RECHAZADO → marcar como fallido + notificar ===
  if (status === "rejected") {
    // No desactivamos el plan inmediatamente — el transportista sigue teniendo acceso
    // hasta que planActivoHasta pase (periodo de gracia).
    // MP automáticamente hará retry en los próximos días.

    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET mpSubStatus = 'payment_failed', suscripcionActiva = 0 WHERE id = ?`,
      userId
    ).catch(() => {});

    const motivo = traducirRechazo(statusDetail);

    await akuoNotificar(
      userId,
      "pago_recurrente_fallido",
      "❌ Pago de subscripción fallido",
      `No se pudo cobrar tu subscripción al plan ${planId} (${motivo}). MP va a reintentar automáticamente. Tu plan sigue activo hasta el ${await getPlanVencimiento(userId)}.`,
      "/akuosplash/transportista?tab=subscripcion"
    );

    return NextResponse.json({
      ok: true,
      event: "pago_recurrente_rejected",
      userId, planId, ciclo, amount,
      statusDetail,
    });
  }

  // === Pago pendiente o en proceso → solo log ===
  if (status === "pending" || status === "in_process") {
    return NextResponse.json({
      ok: true,
      event: "pago_recurrente_pending",
      userId, planId, status,
    });
  }

  return NextResponse.json({ ok: true, status, ignored: true });
}

// === HELPERS ===

// Traduce los motivos de rechazo más comunes de MP a español
function traducirRechazo(statusDetail: string | undefined): string {
  if (!statusDetail) return "motivo desconocido";
  const map: Record<string, string> = {
    "cc_rejected_card_disabled": "tarjeta deshabilitada",
    "cc_rejected_card_expired": "tarjeta vencida",
    "cc_rejected_insufficient_amount": "fondos insuficientes",
    "cc_rejected_invalid_installments": "cuotas inválidas",
    "cc_rejected_max_attempts": "demasiados intentos fallidos",
    "cc_rejected_call_for_authorize": "rechazada por el banco (llamar para autorizar)",
    "cc_rejected_card_type_not_allowed": "tipo de tarjeta no permitido",
    "cc_rejected_high_risk_payment": "rechazada por alto riesgo",
    "cc_rejected_other_reason": "rechazada por el banco",
  };
  return map[statusDetail] || statusDetail;
}

// Lee la fecha de vencimiento del plan del usuario (string formateado)
async function getPlanVencimiento(userId: string): Promise<string> {
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT planActivoHasta FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      userId
    ).catch(() => []);
    if (Array.isArray(r) && r.length > 0 && r[0]?.planActivoHasta) {
      return new Date(r[0].planActivoHasta).toLocaleDateString("es-CL");
    }
  } catch {}
  return "fecha no disponible";
}

// Fallback: actualiza el usuario via raw SQL
async function updateViaRawSql(userId: string, updateData: any) {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(updateData)) {
    if (v === null || v === undefined) continue;
    fields.push(`${k} = ?`);
    values.push(v instanceof Date ? v.toISOString() : v);
  }
  if (fields.length === 0) return;
  values.push(userId);
  await akuosplashDb.$executeRawUnsafe(
    `UPDATE AkuoUsuario SET ${fields.join(", ")} WHERE id = ?`,
    ...values
  ).catch(() => {});
}

// MP manda un GET cuando se registra la URL para verificar
export async function GET() {
  return NextResponse.json({ ok: true });
}
