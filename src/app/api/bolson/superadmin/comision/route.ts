// GET /api/bolson/superadmin/comision — devuelve la config de comisión actual
// POST /api/bolson/superadmin/comision — actualiza la config de comisión
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET() {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const cfg = await bolsonDb.bolsonComisionConfig.findFirst({ where: { activo: true } });
  return NextResponse.json({ comision: cfg });
}

export async function POST(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json();
  const existing = await bolsonDb.bolsonComisionConfig.findFirst({ where: { superadminId: user.id } });
  if (existing) {
    const actualizado = await bolsonDb.bolsonComisionConfig.update({
      where: { id: existing.id },
      data: {
        porcentajeComision: body.porcentajeComision !== undefined ? Number(body.porcentajeComision) : existing.porcentajeComision,
        montoFijoComision: body.montoFijoComision !== undefined ? Number(body.montoFijoComision) : existing.montoFijoComision,
        montoMinimoComision: body.montoMinimoComision !== undefined ? Number(body.montoMinimoComision) : existing.montoMinimoComision,
        aplicaPorCategoria: body.aplicaPorCategoria !== undefined ? !!body.aplicaPorCategoria : existing.aplicaPorCategoria,
        categoriasConfig: body.categoriasConfig !== undefined ? body.categoriasConfig : existing.categoriasConfig,
        publicacionPremiumHabilitada: body.publicacionPremiumHabilitada !== undefined ? !!body.publicacionPremiumHabilitada : existing.publicacionPremiumHabilitada,
        publicacionPremiumMonto: body.publicacionPremiumMonto !== undefined ? Number(body.publicacionPremiumMonto) : existing.publicacionPremiumMonto,
      },
    });
    await bolsonDb.bolsonAuditLog.create({
      data: { superadminId: user.id, accion: "cambiar_comision", entidad: "BolsonComisionConfig", entidadId: existing.id, detalles: JSON.stringify(body) },
    });
    return NextResponse.json({ comision: actualizado });
  }

  const nueva = await bolsonDb.bolsonComisionConfig.create({
    data: {
      superadminId: user.id,
      porcentajeComision: body.porcentajeComision !== undefined ? Number(body.porcentajeComision) : 0,
      montoFijoComision: body.montoFijoComision !== undefined ? Number(body.montoFijoComision) : 0,
      montoMinimoComision: body.montoMinimoComision !== undefined ? Number(body.montoMinimoComision) : 0,
      aplicaPorCategoria: body.aplicaPorCategoria || false,
      categoriasConfig: body.categoriasConfig || null,
      publicacionPremiumHabilitada: body.publicacionPremiumHabilitada || false,
      publicacionPremiumMonto: body.publicacionPremiumMonto ? Number(body.publicacionPremiumMonto) : 0,
      activo: true,
    },
  });
  await bolsonDb.bolsonAuditLog.create({
    data: { superadminId: user.id, accion: "crear_comision", entidad: "BolsonComisionConfig", entidadId: nueva.id, detalles: JSON.stringify(body) },
  });
  return NextResponse.json({ comision: nueva }, { status: 201 });
}
