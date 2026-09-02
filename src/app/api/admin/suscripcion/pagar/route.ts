import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { crearPreferenciaSuscripcion } from "@/lib/mercadopago";

// POST /api/admin/suscripcion/pagar
// Crea una preferencia de pago para suscripción del plan
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const planId = body.planId;

    if (!planId) {
      return NextResponse.json({ error: "planId es obligatorio" }, { status: 400 });
    }

    const plan = await db.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.activo) {
      return NextResponse.json({ error: "Plan no válido" }, { status: 400 });
    }

    if (plan.precioMensual <= 0) {
      return NextResponse.json({ error: "Este plan es gratis, no requiere pago" }, { status: 400 });
    }

    const config = await db.configuracion.findUnique({
      where: { duenoId },
      select: { nombreDueno: true },
    });

    const usuario = await db.usuario.findUnique({
      where: { id: duenoId },
      select: { email: true, nombre: true },
    });

    const pref = await crearPreferenciaSuscripcion({
      duenoId,
      duenoNombre: config?.nombreDueno || usuario?.nombre || "Admin",
      email: usuario?.email || "",
      planId: plan.id,
      planNombre: plan.nombre,
      monto: plan.precioMensual,
    });

    return NextResponse.json({
      preferenceId: pref.preferenceId,
      initPoint: pref.initPoint,
      sandboxInitPoint: pref.sandboxInitPoint,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo crear el pago" },
      { status: 500 }
    );
  }
}
