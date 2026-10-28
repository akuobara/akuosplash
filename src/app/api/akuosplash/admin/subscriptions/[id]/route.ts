import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns, getMpSubCreds } from "@/lib/akuosplash-plans";

// PATCH /api/akuosplash/admin/subscriptions/[id]
// Permite al superadmin gestionar una subscripción:
//   Body: { action: "activate" | "pause" | "suspend" | "cancel" | "reactivate", razon?: string, extenderDias?: number }
//
// - activate: marca como authorized y activa el plan
// - pause: llama a MP para pausar la preapproval
// - suspend: suspensión LOCAL del superadmin (sin llamar a MP) — mpSubSuspended=true
// - cancel: llama a MP para cancelar la preapproval
// - reactivate: quita la suspensión local (mpSubSuspended=false)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  const { id: userId } = await params;
  const body = await req.json();
  const action = body.action as string;
  const razon = body.razon as string | undefined;
  const extenderDias = body.extenderDias as number | undefined;

  if (!["activate", "pause", "suspend", "cancel", "reactivate"].includes(action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  // Leer datos actuales del usuario
  let usuario: any = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, email, nombre, plan, planActivoDesde, planActivoHasta, mpSubPreapprovalId, mpSubPlanSolicitado, mpSubCiclo, mpSubStatus
       FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      userId
    );
    if (Array.isArray(r) && r.length > 0) usuario = r[0];
  } catch {}
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const ahora = new Date();

  // === ACTIVAR: marca como authorized, activa el plan ===
  if (action === "activate") {
    const planId = usuario.mpSubPlanSolicitado || usuario.plan || "premium";
    const ciclo = usuario.mpSubCiclo || "mensual";

    const fin = new Date(ahora);
    if (ciclo === "anual") fin.setFullYear(fin.getFullYear() + 1);
    else fin.setMonth(fin.getMonth() + 1);

    // Si se pidió extender N días, sumarlos
    if (extenderDias && extenderDias > 0) {
      fin.setDate(fin.getDate() + extenderDias);
    }

    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET
        plan = ?, planActivoDesde = ?, planActivoHasta = ?,
        mpSubStatus = 'authorized', mpSubAutorizadoEn = ?,
        mpSubSuspended = 0, suscripcionActiva = 1
       WHERE id = ?`,
      planId, ahora.toISOString(), fin.toISOString(), ahora.toISOString(), userId
    ).catch(() => {});

    await akuoNotificar(userId, "admin_plan_activado", "✅ Plan activado por administrador",
      `Tu plan ${planId} fue activado manualmente por el administrador. Válido hasta ${fin.toLocaleDateString("es-CL")}.`,
      "/akuosplash/transportista?tab=subscripcion");

    return NextResponse.json({
      ok: true,
      action: "activate",
      userId,
      plan: planId,
      planActivoHasta: fin.toISOString(),
    });
  }

  // === SUSPENDER: marca flag local mpSubSuspended=true (no toca MP) ===
  if (action === "suspend") {
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET
        mpSubSuspended = 1, mpSubSuspendedEn = ?, mpSubSuspendedPor = ?, mpSubSuspendedRazon = ?,
        suscripcionActiva = 0
       WHERE id = ?`,
      ahora.toISOString(), user.id, razon || "Suspendido por superadmin", userId
    ).catch(() => {});

    await akuoNotificar(userId, "admin_plan_suspendido", "⏸ Plan suspendido por administrador",
      `Tu plan fue suspendido por el administrador${razon ? `: ${razon}` : ""}. Ya no podés usar las funciones de tu plan hasta que se reactive.`,
      "/akuosplash/transportista?tab=subscripcion");

    return NextResponse.json({ ok: true, action: "suspend", userId, razon });
  }

  // === REACTIVAR: quita la suspensión local ===
  if (action === "reactivate") {
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET
        mpSubSuspended = 0, mpSubSuspendedEn = NULL, mpSubSuspendedPor = NULL, mpSubSuspendedRazon = NULL,
        suscripcionActiva = 1
       WHERE id = ?`,
      userId
    ).catch(() => {});

    await akuoNotificar(userId, "admin_plan_reactivado", "▶️ Plan reactivado por administrador",
      `La suspensión de tu plan fue levantada por el administrador. Ya podés volver a usar todas las funciones.`,
      "/akuosplash/transportista?tab=subscripcion");

    return NextResponse.json({ ok: true, action: "reactivate", userId });
  }

  // === PAUSAR: llama a MP para pausar la preapproval ===
  if (action === "pause") {
    if (!usuario.mpSubPreapprovalId) {
      return NextResponse.json({ error: "El usuario no tiene preapproval en MP" }, { status: 400 });
    }
    const subCreds = await getMpSubCreds();
    if (!subCreds.accessToken) {
      return NextResponse.json({ error: "MP no configurado" }, { status: 500 });
    }
    try {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${usuario.mpSubPreapprovalId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${subCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "paused" }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return NextResponse.json({ error: `MP error ${r.status}: ${d.message || ""}` }, { status: 502 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "No se pudo pausar en MP" }, { status: 500 });
    }

    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET mpSubStatus = 'paused', suscripcionActiva = 0 WHERE id = ?`,
      userId
    ).catch(() => {});

    await akuoNotificar(userId, "admin_plan_pausado", "⏸ Subscripción pausada por administrador",
      `Tu subscripción fue pausada por el administrador${razon ? `: ${razon}` : ""}. El plan sigue activo hasta el vencimiento.`,
      "/akuosplash/transportista?tab=subscripcion");

    return NextResponse.json({ ok: true, action: "pause", userId });
  }

  // === CANCELAR: llama a MP para cancelar la preapproval ===
  if (action === "cancel") {
    if (!usuario.mpSubPreapprovalId) {
      return NextResponse.json({ error: "El usuario no tiene preapproval en MP" }, { status: 400 });
    }
    const subCreds = await getMpSubCreds();
    if (!subCreds.accessToken) {
      return NextResponse.json({ error: "MP no configurado" }, { status: 500 });
    }
    try {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${usuario.mpSubPreapprovalId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${subCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        return NextResponse.json({ error: `MP error ${r.status}: ${d.message || ""}` }, { status: 502 });
      }
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "No se pudo cancelar en MP" }, { status: 500 });
    }

    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET mpSubStatus = 'cancelled', suscripcionActiva = 0 WHERE id = ?`,
      userId
    ).catch(() => {});

    await akuoNotificar(userId, "admin_plan_cancelado", "🛑 Subscripción cancelada por administrador",
      `Tu subscripción fue cancelada por el administrador${razon ? `: ${razon}` : ""}. El plan sigue activo hasta el vencimiento, después pasarás a Gratis.`,
      "/akuosplash/transportista?tab=subscripcion");

    return NextResponse.json({ ok: true, action: "cancel", userId });
  }

  return NextResponse.json({ error: "Acción no implementada" }, { status: 400 });
}
