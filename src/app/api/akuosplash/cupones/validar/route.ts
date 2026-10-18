import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/cupones/validar
// Valida un cupón (sin aplicarlo) — devuelve info del descuento si es válido.
// Body: { codigo, tipo: "venta" | "subscripcion", monto?, planId? }
// Response: { valido, cupon?, descuento, montoFinal, razon? }
export async function POST(req: NextRequest) {
  await ensureAkuoConfigColumns();
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const codigo = (body.codigo || "").trim().toUpperCase();
  const tipo = body.tipo as "venta" | "subscripcion";
  const monto = body.monto as number | undefined;
  const planId = body.planId as string | undefined;

  if (!codigo || !tipo) {
    return NextResponse.json({ error: "Código y tipo son obligatorios" }, { status: 400 });
  }

  // Buscar el cupón
  let cupon: any = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT * FROM AkuoCupon WHERE codigo = ? AND tipo = ? LIMIT 1`,
      codigo, tipo
    );
    if (Array.isArray(r) && r.length > 0) cupon = r[0];
  } catch (e: any) {
    return NextResponse.json({ error: "Error al buscar cupón: " + (e?.message || "") }, { status: 500 });
  }

  if (!cupon) {
    return NextResponse.json({
      valido: false,
      razon: "Cupón no encontrado",
    });
  }

  if (!cupon.activo) {
    return NextResponse.json({
      valido: false,
      razon: "Cupón inactivo",
    });
  }

  // Verificar vigencia
  const ahora = new Date();
  const inicio = new Date(cupon.fechaInicio);
  if (ahora < inicio) {
    return NextResponse.json({
      valido: false,
      razon: `Cupón válido desde ${inicio.toLocaleDateString("es-CL")}`,
    });
  }
  if (cupon.fechaFin) {
    const fin = new Date(cupon.fechaFin);
    if (ahora > fin) {
      return NextResponse.json({
        valido: false,
        razon: "Cupón vencido",
      });
    }
  }

  // Verificar usos máximos
  if (cupon.maxUsos > 0 && cupon.usos >= cupon.maxUsos) {
    return NextResponse.json({
      valido: false,
      razon: "Cupón agotado (alcanzó el máximo de usos)",
    });
  }

  // Verificar monto mínimo
  if (cupon.minMonto && monto !== undefined) {
    if (monto < cupon.minMonto) {
      return NextResponse.json({
        valido: false,
        razon: `Monto mínimo para este cupón: $${cupon.minMonto}`,
      });
    }
  }

  // Verificar plan aplicable (para cupones de subscripción)
  if (cupon.planIdAplicable && planId) {
    if (cupon.planIdAplicable !== planId) {
      return NextResponse.json({
        valido: false,
        razon: `Este cupón solo aplica al plan ${cupon.planIdAplicable}`,
      });
    }
  }

  // Verificar uso único por usuario (si maxUsos = 1, no debería poder usarlo 2 veces)
  if (user) {
    try {
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT id FROM AkuoUsuarioCupon WHERE cuponId = ? AND usuarioId = ? LIMIT 1`,
        cupon.id, user.id
      );
      if (Array.isArray(r) && r.length > 0) {
        return NextResponse.json({
          valido: false,
          razon: "Ya usaste este cupón anteriormente",
        });
      }
    } catch {}
  }

  // Calcular descuento
  let descuento = 0;
  let montoFinal = monto || 0;
  let mesesGratis = 0;
  if (cupon.descuentoTipo === "porcentaje") {
    descuento = Math.round(((monto || 0) * cupon.descuentoValor) / 100);
    montoFinal = (monto || 0) - descuento;
  } else if (cupon.descuentoTipo === "monto_fijo") {
    descuento = cupon.descuentoValor;
    montoFinal = Math.max(0, (monto || 0) - descuento);
  } else if (cupon.descuentoTipo === "meses_gratis") {
    // Para subscripción: descuento es el monto × meses gratis
    mesesGratis = Math.floor(cupon.descuentoValor);
    descuento = (monto || 0) * mesesGratis;
    montoFinal = 0; // primer mes gratis
  }

  return NextResponse.json({
    valido: true,
    cupon: {
      id: cupon.id,
      codigo: cupon.codigo,
      tipo: cupon.tipo,
      descuentoTipo: cupon.descuentoTipo,
      descuentoValor: cupon.descuentoValor,
      descripcionPublica: cupon.descripcionPublica,
    },
    descuento,
    montoFinal,
    mesesGratis,
  });
}
