import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns, getMpSubCreds } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/cancel
// Permite al transportista cancelar su subscripción activa.
// - Llama a la API de MP para cancelar la preapproval
// - Marca el plan como cancelado en la DB (suscripcionActiva = false)
// - El plan sigue activo hasta planActivoHasta (periodo de gracia)
// - Notifica al transportista
export async function POST(req: NextRequest) {
  await ensureAkuoConfigColumns();
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Leer el preapprovalId actual del usuario
  let preapprovalId: string | null = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpSubPreapprovalId, plan, planActivoHasta FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      user.id
    );
    if (Array.isArray(r) && r.length > 0) {
      preapprovalId = r[0]?.mpSubPreapprovalId || null;
    }
  } catch {}

  if (!preapprovalId) {
    return NextResponse.json({ error: "No tenés subscripción activa para cancelar" }, { status: 400 });
  }

  // Llamar a MP para cancelar la preapproval
  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) {
    return NextResponse.json({ error: "MP no configurado" }, { status: 500 });
  }

  try {
    const r = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${subCreds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      console.error("[mp sub cancel]", r.status, data);
      return NextResponse.json({
        error: `MP error ${r.status}: ${data.message || data.error || ""}`,
      }, { status: 502 });
    }
  } catch (e: any) {
    console.error("[mp sub cancel exception]", e);
    return NextResponse.json({ error: e?.message || "No se pudo cancelar en MP" }, { status: 500 });
  }

  // Actualizar la DB — plan sigue activo hasta vencimiento, pero suscripcionActiva = false
  await akuosplashDb.$executeRawUnsafe(
    `UPDATE AkuoUsuario SET mpSubStatus = 'cancelled', suscripcionActiva = 0 WHERE id = ?`,
    user.id
  ).catch(() => {});

  // Notificar al transportista
  await akuoNotificar(
    user.id,
    "sub_cancelada_usuario",
    "🛑 Subscripción cancelada",
    `Cancelaste tu subscripción. Tu plan sigue activo hasta el vencimiento, después pasarás a plan Gratis.`,
    "/akuosplash/transportista?tab=subscripcion"
  );

  return NextResponse.json({
    ok: true,
    message: "Subscripción cancelada. Tu plan sigue activo hasta el vencimiento.",
  });
}
