import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns, getPlanConfigs, getMpSubCreds, PlanId } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/retry
// Permite al transportista reintentar el pago de su subscripción después de un fallo.
// - Si la preapproval estaba paused/cancelled/payment_failed, crea una nueva preapproval
// - El usuario es redirigido al init_point de MP para autorizarla
// Body: { plan: "premium" | "pro", ciclo: "mensual" | "anual" }
// Devuelve: { initPoint, preapprovalId }
export async function POST(req: NextRequest) {
  await ensureAkuoConfigColumns();
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json();
  const planRaw: string = body.plan || "premium";
  const cicloRaw: string = body.ciclo || "mensual";
  const ciclo: "mensual" | "anual" | "semanal" | "diario" =
    cicloRaw === "anual" ? "anual" : cicloRaw === "semanal" ? "semanal" : cicloRaw === "diario" ? "diario" : "mensual";

  // Cargar config + MP creds
  const configs = await getPlanConfigs();
  const planLookupKey = planRaw === "pago" ? "premium" : planRaw;
  const planCfg = (configs as any)[planLookupKey];
  if (!planCfg) return NextResponse.json({ error: `Plan '${planRaw}' no encontrado` }, { status: 400 });
  const planId = planLookupKey;
  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) {
    return NextResponse.json({ error: "MP Subscriptions no configurado" }, { status: 500 });
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.onrender.com";
  const amount = ciclo === "anual" ? planCfg.precioAnual
    : ciclo === "semanal" ? planCfg.precioSemanal
    : ciclo === "diario" ? planCfg.precioDiario
    : planCfg.precioMensual;
  const frequency = ciclo === "anual" ? 12 : ciclo === "semanal" ? 7 : 1;
  const frequencyType: "days" | "months" = (ciclo === "semanal" || ciclo === "diario") ? "days" : "months";

  // MP test user email (si está configurado)
  let mpPayerEmail = user.email || "";
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpTestUserEmail FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      user.id
    ).catch(() => []);
    if (Array.isArray(r) && r.length > 0 && r[0]?.mpTestUserEmail) {
      mpPayerEmail = r[0].mpTestUserEmail;
    }
  } catch {}

  // Crear preapproval_PLAN en MP (modelo actual — el inline queda con activation=true y botón gris).
  const mpBody: any = {
    reason: `AkuoSplash — Plan ${planCfg.nombre} (${ciclo}) — reintento`,
    auto_recurring: {
      frequency,
      frequency_type: frequencyType,
      transaction_amount: amount,
      currency_id: "CLP",
    },
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    external_reference: `akuo_sub:${user.id}:${planId}:${ciclo}`,
    // Sin payment_methods_allowed: MP lo guarda vacío ({}) y no aporta nada.
  };

  const apiBase = "https://api.mercadopago.com";

  // === MODO SANDBOX ===
  // Caso A: token TEST- (credenciales de prueba del panel) → checkout web sandbox (sandbox_init_point).
  // Caso B: token APP_USR- de test user → flujo API directo con tarjeta de prueba
  //   (el checkout web con ese token corre en producción: tarjetas de prueba no confirman).
  const isTestCredToken = subCreds.accessToken.startsWith("TEST-");
  if (subCreds.sandbox && !isTestCredToken) {
    try {
      const PAYER_EMAIL = mpPayerEmail.includes("@testuser.com")
        ? mpPayerEmail
        : user.email.includes("@testuser.com") ? user.email : "test_user_2094743021490827193@testuser.com";
      const ctRes = await fetch(`${apiBase}/v1/card_tokens`, {
        method: "POST",
        headers: { Authorization: `Bearer ${subCreds.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: "5416752602582580", // Mastercard crédito (tarjeta de prueba MP Chile)
          security_code: "123",
          expiration_month: 11,
          expiration_year: 2030,
          cardholder: { name: "APRO" },
        }),
      });
      const ct = await ctRes.json();
      if (!ctRes.ok || !ct.id) {
        console.error("[mp sub retry sandbox] card_token failed", ct);
        return NextResponse.json({ error: `MP no pudo tokenizar la tarjeta de prueba: ${ct.message || ctRes.status}` }, { status: 502 });
      }

      const planRes = await fetch(`${apiBase}/preapproval_plan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${subCreds.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(mpBody),
      });
      const planData = await planRes.json();
      if (!planRes.ok) {
        console.error("[mp sub retry sandbox] plan failed", planData);
        return NextResponse.json({ error: planData.message || `MP error plan ${planRes.status}` }, { status: 500 });
      }

      const preRes = await fetch(`${apiBase}/preapproval`, {
        method: "POST",
        headers: { Authorization: `Bearer ${subCreds.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          preapproval_plan_id: planData.id,
          reason: mpBody.reason,
          payer_email: PAYER_EMAIL,
          card_token_id: ct.id,
          external_reference: mpBody.external_reference,
          back_url: mpBody.back_url,
        }),
      });
      const preData = await preRes.json();
      if (!preRes.ok) {
        console.error("[mp sub retry sandbox] preapproval failed", preData);
        return NextResponse.json({ error: preData.message || `MP error preapproval ${preRes.status}` }, { status: 500 });
      }

      const authorized = preData.status === "authorized";
      const ahora = new Date();
      const fin = new Date(ahora);
      if (ciclo === "anual") fin.setFullYear(fin.getFullYear() + 1);
      else if (ciclo === "semanal") fin.setDate(fin.getDate() + 7);
      else if (ciclo === "diario") fin.setDate(fin.getDate() + 1);
      else fin.setMonth(fin.getMonth() + 1);

      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoUsuario SET
          mpSubPreapprovalId = ?, mpSubPlanSolicitado = ?, mpSubCiclo = ?,
          mpSubStatus = ?, mpSubIniciadoEn = ?, mpSubAmount = ?,
          plan = ?, planActivoDesde = ?, planActivoHasta = ?,
          mpSubAutorizadoEn = ?, suscripcionActiva = ?
         WHERE id = ?`,
        preData.id, planId, ciclo, preData.status || "authorized", ahora.toISOString(), amount,
        planId, ahora.toISOString(), fin.toISOString(),
        authorized ? ahora.toISOString() : null, authorized ? 1 : 0,
        user.id
      ).catch(() => {});

      return NextResponse.json({
        ok: true,
        sandbox: true,
        authorized,
        preapprovalId: preData.id,
        amount,
        planId,
        ciclo,
        planActivoHasta: fin.toISOString(),
      });
    } catch (e: any) {
      console.error("[mp sub retry sandbox exception]", e);
      return NextResponse.json({ error: e?.message || "Error en reintento sandbox" }, { status: 500 });
    }
  }

  // === MODO PRODUCCIÓN: checkout web ===
  try {
    const r = await fetch(`${apiBase}/preapproval_plan`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${subCreds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("[mp sub retry]", data);
      return NextResponse.json({
        error: data.message || data.error || `MP error ${r.status}`,
      }, { status: 500 });
    }

    // El plan devuelve init_point SIN activation=true.
    // Con credenciales TEST-, preferir sandbox_init_point (checkout donde las tarjetas de prueba confirman).
    const initPoint = data.sandbox_init_point || data.init_point;
    if (!initPoint) {
      return NextResponse.json({ error: "MP no devolvió init_point del plan", data }, { status: 500 });
    }

    // Guardamos el plan_id (temporal — el webhook lo reemplaza por el preapproval_id real).
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET
        mpSubPreapprovalId = ?,
        mpSubPlanSolicitado = ?,
        mpSubCiclo = ?,
        mpSubStatus = 'pending',
        mpSubIniciadoEn = ?,
        mpSubAmount = ?
       WHERE id = ?`,
      data.id, planId, ciclo, new Date().toISOString(), amount, user.id
    ).catch(() => {});

    return NextResponse.json({
      ok: true,
      initPoint,
      preapprovalId: data.id,
      amount,
      planId,
      ciclo,
    });
  } catch (e: any) {
    console.error("[mp sub retry exception]", e);
    return NextResponse.json({ error: e?.message || "Error al crear nueva preapproval" }, { status: 500 });
  }
}
