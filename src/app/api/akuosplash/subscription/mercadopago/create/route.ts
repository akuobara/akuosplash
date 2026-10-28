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
  // Aceptar "pago" (legacy) o "premium" o "pro"
  const planRaw: string = body.plan;
  const planId: PlanId = planRaw === "pro" ? "pro" : (planRaw === "pago" || planRaw === "premium" ? "premium" : "premium");
  const ciclo: "mensual" | "anual" = body.ciclo === "anual" ? "anual" : "mensual";

  // Cargar config de plan + MP creds (cuenta de subscriptions)
  const configs = await getPlanConfigs();
  const planCfg = configs[planId];
  const subCreds = await getMpSubCreds();
  if (!subCreds.accessToken) {
    return NextResponse.json({
      error: "MercadoPago Subscriptions no configurado. Pedile al superadmin que lo configure en Integraciones.",
    }, { status: 500 });
  }

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://my-project-azure-five-82.vercel.app";
  let amount = ciclo === "anual" ? planCfg.precioAnual : planCfg.precioMensual;
  const frequency = ciclo === "anual" ? 12 : 1;
  const frequencyType = "months";

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

  // Crear preapproval en MP
  // https://www.mercadopago.cl/developers/en/docs/subscriptions/api/preapprovals
  const mpBody: any = {
    reason: `AkuoSplash — Plan ${planCfg.nombre} (${ciclo})`,
    auto_recurring: {
      frequency,
      frequency_type: frequencyType,
      transaction_amount: amount,
      currency_id: "CLP",
    },
    payer_email: mpPayerEmail,
    back_url: `${APP_URL}/akuosplash/transportista?tab=subscripcion`,
    status: "pending",
    external_reference: `akuo_sub:${user.id}:${planId}:${ciclo}`,
    notification_url: `${APP_URL}/api/akuosplash/subscription/mercadopago/webhook`,
  };
  // Si hay meses gratis (cupón meses_gratis), agregar free_trial
  if (mesesGratis > 0) {
    mpBody.auto_recurring.free_trial = {
      frequency: mesesGratis,
      frequency_type: "months",
    };
  }

  // Sandbox siempre es true para preapprovals (MP no tiene sandbox_init_point separado para subscriptions)
  // El access token ya es de la cuenta correcta (sandbox o producción según esté configurado).
  const apiBase = "https://api.mercadopago.com";

  try {
    const res = await fetch(`${apiBase}/preapproval`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${subCreds.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mpBody),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[mp sub create]", data);
      const msg = data.message || data.error || `MP error ${res.status}`;
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // MP subscriptions: init_point para producción, sandbox_init_point para sandbox
    // Si el access token es de test (empieza con TEST-), usar sandbox_init_point
    const isSandbox = subCreds.accessToken.startsWith("TEST-") || subCreds.accessToken.includes("sandbox");
    const initPoint = isSandbox
      ? (data.sandbox_init_point || data.init_point)
      : (data.init_point || data.sandbox_init_point);
    if (!initPoint) {
      return NextResponse.json({ error: "MP no devolvió init_point", data }, { status: 500 });
    }

    // Guardar la preapproval pendiente en la DB (via raw SQL para evitar Prisma errors)
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
