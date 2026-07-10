import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/configuracion  — crea el registro por defecto si no existe
export async function GET() {
  let config = await db.configuracion.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await db.configuracion.create({ data: { id: "default" } });
  }
  return NextResponse.json({ configuracion: config });
}

// PUT /api/configuracion
export async function PUT(req: NextRequest) {
  const body = await req.json();

  const config = await db.configuracion.upsert({
    where: { id: "default" },
    update: {
      ...(body.nombreChofer !== undefined && { nombreChofer: body.nombreChofer.trim() }),
      ...(body.nombreDueno !== undefined && { nombreDueno: body.nombreDueno.trim() }),
      ...(body.capacidadCamion !== undefined && { capacidadCamion: Number(body.capacidadCamion) || 17000 }),
      ...(body.modoLiquidacion !== undefined && { modoLiquidacion: body.modoLiquidacion }),
      ...(body.porcentajeComisionChofer !== undefined && { porcentajeComisionChofer: Number(body.porcentajeComisionChofer) }),
      ...(body.porcentajeComisionDueno !== undefined && { porcentajeComisionDueno: Number(body.porcentajeComisionDueno) }),
      ...(body.montoPorVueltaUnicoCliente !== undefined && { montoPorVueltaUnicoCliente: Number(body.montoPorVueltaUnicoCliente) }),
      ...(body.montoPorVueltaMultiple !== undefined && { montoPorVueltaMultiple: Number(body.montoPorVueltaMultiple) }),
      ...(body.precioEfectivoPorLitro !== undefined && { precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) }),
      ...(body.precioTransferenciaPorLitro !== undefined && { precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) }),
    },
    create: {
      id: "default",
      nombreChofer: body.nombreChofer?.trim() || "Chofer",
      nombreDueno: body.nombreDueno?.trim() || "Dueño del Camión",
      capacidadCamion: Number(body.capacidadCamion) || 17000,
      modoLiquidacion: body.modoLiquidacion || "porcentaje",
      porcentajeComisionChofer: Number(body.porcentajeComisionChofer) || 50,
      porcentajeComisionDueno: Number(body.porcentajeComisionDueno) || 50,
      montoPorVueltaUnicoCliente: Number(body.montoPorVueltaUnicoCliente) || 20000,
      montoPorVueltaMultiple: Number(body.montoPorVueltaMultiple) || 25000,
      precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0,
      precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0,
    },
  });

  return NextResponse.json({ configuracion: config });
}
