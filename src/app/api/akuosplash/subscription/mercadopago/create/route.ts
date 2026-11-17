import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPlanConfigs, getMpSubCreds, PlanId } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/subscription/mercadopago/create
// Crea una preapproval (subscripción recurrente) en MercadoPago para el plan seleccionado.
// Usa la cuenta MP de SUBSCRIPTIONS (separada de la de split del marketplace).
// Body: { plan: "premium" | "pro", ciclo: "mensual" | "anual" }
// Devuelve: { initPoint, preapprovalId }
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json();
  // Aceptar cualquier plan id (premium, pro, test, custom) — lookup en plan configs
  const planRaw: string = body.plan || "premium";
  const cicloRaw: string = body.ciclo || "mensual";
  const ciclo: "mensual" | "anual" | "semanal" | "diario" =
    cicloRaw === "anual" ? "anual" : cicloRaw === "semanal" ? "semanal" : cicloRaw === "diario" ? "diario" : "mensual";

  // Cargar config de plan + MP creds (cuenta de subscriptions)
  const configs = await getPlanConfigs();
  // Soportar alias "pago" → "premium"
  const planLookupKey = planRaw === "pago" ? "premium" : planRaw;
  const planCfg = (configs as any)[planLookupKey];
  if (!planCfg) {
    return NextResponse.json({ error: `Plan '${planRaw}' no encontrado` }, { status: 400 });
  }
  const planId = planLookupKey; // alias para que el resto del código funcione (external_reference, cupones, DB)
  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) {
    return NextResponse.json({
      error: "MercadoPago Subscriptions no configurado. Pedile al superadmin que lo configure en Integraciones.",
    }, { status: 500 });
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://akuosplash.onrender.com";
  // Precio según ciclo
  let amount = ciclo === "anual" ? planCfg.precioAnual
    : ciclo === "semanal" ? planCfg.precioSemanal
    : ciclo === "diario" ? planCfg.precioDiario
    : planCfg.precioMensual;
  // Frequency mapping para MP preapproval (frequency_type: "days" | "months")
  let frequency: number;
  let frequencyType: "days" | "months";
  if (ciclo === "anual") { frequency = 12; frequencyType = "months"; }
  else if (ciclo === "semanal") { frequency = 7; frequencyType = "days"; }
  else if (ciclo === "diario") { frequency = 1; frequencyType = "days"; }
  else { frequency = 1; frequencyType = "months"; }

  // === CUPÓN DE SUBSCRIPCIÓN (opcional) ===
  // Si viene couponCode en el body, validar y aplicar descuento
  let cuponAplicado: any = null;
  let mesesGratis = 0;
  let montoAhorrado = 0;
  if (body.couponCode) {
    const codigoCupon = String(body.couponCode).trim().toUpperCase();
    let cupon: any = null;
    try {
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT * FROM AkuoCupon WHERE codigo = ? AND tipo = 'subscripcion' AND activo = 1 LIMIT 1`,
        codigoCupon
      );
      if (Array.isArray(r) && r.length > 0) cupon = r[0];
    } catch {}

    if (!cupon) {
      return NextResponse.json({ error: `Cupón '${codigoCupon}' no válido o inactivo` }, { status: 400 });
    }

    // Verificar vigencia
    const ahora = new Date();
    if (new Date(cupon.fechaInicio) > ahora) {
      return NextResponse.json({ error: "Cupón aún no está vigente" }, { status: 400 });
    }
    if (cupon.fechaFin && new Date(cupon.fechaFin) < ahora) {
      return NextResponse.json({ error: "Cupón vencido" }, { status: 400 });
    }
    if (cupon.maxUsos > 0 && cupon.usos >= cupon.maxUsos) {
      return NextResponse.json({ error: "Cupón agotado" }, { status: 400 });
    }
    if (cupon.planIdAplicable && cupon.planIdAplicable !== planId) {
      return NextResponse.json({ error: `Este cupón solo aplica al plan ${cupon.planIdAplicable}` }, { status: 400 });
    }
    // Verificar uso único por usuario
    const yaUso: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id FROM AkuoUsuarioCupon WHERE cuponId = ? AND usuarioId = ? LIMIT 1`,
      cupon.id, user.id
    ).catch(() => []);
    if (Array.isArray(yaUso) && yaUso.length > 0) {
      return NextResponse.json({ error: "Ya usaste este cupón antes" }, { status: 400 });
    }

    // Aplicar descuento
    if (cupon.descuentoTipo === "porcentaje") {
      const descuento = Math.round((amount * cupon.descuentoValor) / 100);
      montoAhorrado = descuento;
      amount = Math.max(0, amount - descuento);
    } else if (cupon.descuentoTipo === "monto_fijo") {
      montoAhorrado = cupon.descuentoValor;
      amount = Math.max(0, amount - cupon.descuentoValor);
    } else if (cupon.descuentoTipo === "meses_gratis") {
      // Para meses_gratis: la preapproval se crea con monto 0 para los primeros N meses
      // MP permite free_trial en auto_recurring — configurarlo
      mesesGratis = Math.floor(cupon.descuentoValor);
      montoAhorrado = amount * mesesGratis;
      // NO se cambia el amount — el descuento se aplica con free_trial en MP
    }
    cuponAplicado = cupon;
  }

  // Si el transportista tiene un MP test user email configurado, usar ese (no su email de AkuoSplash)
  // MP sandbox requiere payer_email en formato test_user_<numeric>@testuser.com
  // Lo leemos del campo `mpTestUserEmail` si existe, sino caemos a user.email
  // (Nota: en el modelo PLAN el payer_email no va en el plan — el payer lo ingresa en el checkout.
  //  Se mantiene la lectura para compatibilidad con otros flujos.)
  let mpPayerEmail = user.email || "";
  try {
    const result: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpTestUserEmail FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      user.id
    ).catch(() => []);
    if (Array.isArray(result) && result.length > 0 && result[0]?.mpTestUserEmail) {
      mpPayerEmail = result[0].mpTestUserEmail;
    }
  } catch {}

  // Crear preapproval_PLAN en MP (no preapproval inline).
  // MP deprecó el preapproval inline: le agrega "&activation=true" al checkout y el botón
  // "Confirmar" queda gris (no deja confirmar recurring). El modelo PLAN devuelve un init_point
  // limpio (sin activation=true) y MP crea el preapproval + cobra cuando el payer confirma en el checkout.
  // Creamos un plan único por intento, con external_reference para vincular al usuario en el webhook.
  const mpBody: any = {
    reason: `AkuoSplash — Plan ${planCfg.nombre} (${ciclo})`,
    auto_recurring: {
      frequency,
      frequency_type: frequencyType,
      transaction_amount: amount,
      currency_id: "CLP",
    },
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    external_reference: `akuo_sub:${user.id}:${planId}:${ciclo}`,
    // Sin payment_methods_allowed: MP lo guarda vacío ({}) y no aporta nada.
    // Las subscripciones en CL solo aceptan crédito por sí solas — igual que el
    // preapproval que funcionó el 9/11 (sin restricciones de medio de pago).
  };
  // Si hay meses gratis (cupón meses_gratis), agregar free_trial
  if (mesesGratis > 0) {
    mpBody.auto_recurring.free_trial = {
      frequency: mesesGratis,
      frequency_type: "months",
    };
  }

  const apiBase = "https://api.mercadopago.com";

  // === ANTI-DOBLE-COBRO: cancelar la subscripción ANTERIOR antes de crear una nueva ===
  // Antes: cada clic en "Pagar" creaba una preapproval nueva sin tocar la anterior — si el
  // transportista pagaba 3 veces, las 3 preapprovals quedaban authorized y las 3 cobraban
  // cada ciclo. Ahora: si ya tiene una preapproval viva (authorized/pending), se cancela en
  // MP ANTES de crear la nueva, así un usuario solo puede tener UNA subscripción viva.
  try {
    const prev: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT mpSubPreapprovalId, mpSubStatus FROM AkuoUsuario WHERE id = ? LIMIT 1`,
      user.id
    );
    const prevId = Array.isArray(prev) && prev[0]?.mpSubPreapprovalId;
    const prevStatus = Array.isArray(prev) && prev[0]?.mpSubStatus;
    if (prevId && (prevStatus === "authorized" || prevStatus === "pending")) {
      const cr = await fetch(`${apiBase}/preapproval/${prevId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${subCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "cancelled" }),
      });
      console.log(`[mp sub create] preapproval anterior ${prevId} (${prevStatus}) cancelada: HTTP ${cr.status}`);
    }
  } catch (e: any) {
    // No bloquear la creación si falla la cancelación (quedará rastro en el log)
    console.warn("[mp sub create] no se pudo cancelar la preapproval anterior:", e?.message);
  }

  // === MODO SANDBOX ===
  // Caso A: token TEST- (credenciales de prueba del panel) → checkout web sandbox.
  //   MP devuelve sandbox_init_point y las tarjetas de prueba funcionan en el checkout.
  // Caso B: token APP_USR- de un test user (lo configurado hoy) → flujo API directo.
  //   Con este token MP NO devuelve sandbox_init_point (verificado): el checkout corre en
  //   producción, donde las tarjetas de prueba no se pueden confirmar (botón gris).
  //   Flujo verificado: card_token con access token + preapproval con card_token →
  //   MP la autoriza y cobra al instante (summarized.charged_quantity=1).
  const isTestCredToken = subCreds.accessToken.startsWith("TEST-");
  if (subCreds.sandbox && !isTestCredToken) {
    try {
      // 1) Card token de la tarjeta de PRUEBA (Mastercard crédito CL) con el access token.
      //    Con la public key falla (G001) — la pk de producción no tokeniza tarjetas de prueba.
      const PAYER_EMAIL = mpPayerEmail.includes("@testuser.com")
        ? mpPayerEmail
        : user.email.includes("@testuser.com") ? user.email : "test_user_2094743021490827193@testuser.com";
      const ctRes = await fetch(`${apiBase}/v1/card_tokens`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${subCreds.accessToken}`,
          "Content-Type": "application/json",
        },
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
        console.error("[mp sub create sandbox] card_token failed", ct);
        return NextResponse.json({ error: `MP no pudo tokenizar la tarjeta de prueba: ${ct.message || ctRes.status}` }, { status: 502 });
      }

      // 2) Crear el PLAN (igual que producción — el preapproval necesita un plan en el modelo actual)
      const planRes = await fetch(`${apiBase}/preapproval_plan`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${subCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mpBody),
      });
      const planData = await planRes.json();
      if (!planRes.ok) {
        console.error("[mp sub create sandbox] plan failed", planData);
        return NextResponse.json({ error: planData.message || `MP error plan ${planRes.status}` }, { status: 500 });
      }

      // 3) Preapproval contra el plan con el card token → MP autoriza y cobra al instante
      const preRes = await fetch(`${apiBase}/preapproval`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${subCreds.accessToken}`,
          "Content-Type": "application/json",
        },
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
        console.error("[mp sub create sandbox] preapproval failed", preData);
        return NextResponse.json({ error: preData.message || `MP error preapproval ${preRes.status}` }, { status: 500 });
      }

      // 4) Activar el plan directamente (mismo criterio que el webhook/sync)
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

      // Registrar cupón igual que en producción
      if (cuponAplicado) {
        try {
          const usoId = `cupon_uso_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await akuosplashDb.$executeRawUnsafe(
            `INSERT INTO AkuoUsuarioCupon (id, usadoEn, cuponId, usuarioId, planActivado, montoAhorrado)
             VALUES (?, ?, ?, ?, ?, ?)`,
            usoId, new Date().toISOString(), cuponAplicado.id, user.id, planId, montoAhorrado
          );
          await akuosplashDb.$executeRawUnsafe(
            `UPDATE AkuoCupon SET usos = usos + 1 WHERE id = ?`,
            cuponAplicado.id
          );
        } catch (e: any) {
          console.warn("[mp sub create sandbox] no se pudo registrar uso de cupón:", e?.message);
        }
      }

      return NextResponse.json({
        sandbox: true,
        authorized,
        preapprovalId: preData.id,
        amount,
        planId,
        ciclo,
        planActivoHasta: fin.toISOString(),
        cuponAplicado: cuponAplicado ? {
          codigo: cuponAplicado.codigo,
          descuentoTipo: cuponAplicado.descuentoTipo,
          montoAhorrado,
          mesesGratis,
        } : null,
      });
    } catch (e: any) {
      console.error("[mp sub create sandbox exception]", e);
      return NextResponse.json({ error: e.message || "Error en subscripción sandbox" }, { status: 500 });
    }
  }

  // === MODO PRODUCCIÓN: checkout web ===
  try {
    const res = await fetch(`${apiBase}/preapproval_plan`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${subCreds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[mp sub create plan]", data);
      const msg = data.message || data.error || `MP error ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // El plan devuelve init_point SIN activation=true (modelo actual de MP).
    // Con credenciales TEST- (sandbox real), MP además devuelve sandbox_init_point —
    // usarlo preferentemente: es el checkout donde las tarjetas de prueba SÍ confirman.
    const initPoint = data.sandbox_init_point || data.init_point;
    if (!initPoint) {
      return NextResponse.json({ error: "MP no devolvió init_point del plan", data }, { status: 500 });
    }

    // Guardamos el plan_id en mpSubPreapprovalId (temporal — el webhook lo reemplazará por el
    // preapproval_id real cuando el payer confirme y MP cree el preapproval).
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoUsuario SET
        mpSubPreapprovalId = ?, mpSubPlanSolicitado = ?, mpSubCiclo = ?,
        mpSubStatus = 'pending', mpSubIniciadoEn = ?, mpSubAmount = ?
       WHERE id = ?`,
      data.id, planId, ciclo, new Date().toISOString(), amount, user.id
    ).catch(() => {});

    // Registrar el uso del cupón
    if (cuponAplicado) {
      try {
        const usoId = `cupon_uso_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await akuosplashDb.$executeRawUnsafe(
          `INSERT INTO AkuoUsuarioCupon (id, usadoEn, cuponId, usuarioId, planActivado, montoAhorrado)
           VALUES (?, ?, ?, ?, ?, ?)`,
          usoId, new Date().toISOString(), cuponAplicado.id, user.id, planId, montoAhorrado
        );
        // Incrementar contador de usos
        await akuosplashDb.$executeRawUnsafe(
          `UPDATE AkuoCupon SET usos = usos + 1 WHERE id = ?`,
          cuponAplicado.id
        );
      } catch (e: any) {
        console.warn("[mp sub create] no se pudo registrar uso de cupón:", e?.message);
      }
    }

    return NextResponse.json({
      initPoint,
      preapprovalId: data.id,
      amount,
      planId,
      ciclo,
      cuponAplicado: cuponAplicado ? {
        codigo: cuponAplicado.codigo,
        descuentoTipo: cuponAplicado.descuentoTipo,
        montoAhorrado,
        mesesGratis,
      } : null,
    });
  } catch (e: any) {
    console.error("[mp sub create exception]", e);
    return NextResponse.json({ error: e.message || "Error al crear subscripción" }, { status: 500 });
  }
}
