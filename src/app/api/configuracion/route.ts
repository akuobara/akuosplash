import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/configuracion
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let config = await db.configuracion.findUnique({ where: { duenoId } });
  if (!config) {
    const dueno = await db.usuario.findUnique({ where: { id: duenoId } });
    config = await db.configuracion.create({
      data: {
        duenoId,
        nombreDueno: dueno?.nombre ?? "Dueño",
        nombreChofer: dueno?.nombre ?? "Chofer",
      },
    });
  }
  return NextResponse.json({ configuracion: config });
}

// PUT /api/configuracion — solo dueño
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo dueños pueden cambiar la configuración" }, { status: 403 });
  }

  const body = await req.json();

  const config = await db.configuracion.upsert({
    where: { duenoId: session.userId },
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
      ...(body.tipoTributo !== undefined && { tipoTributo: body.tipoTributo }),
      ...(body.porcentajeImpuesto !== undefined && { porcentajeImpuesto: Number(body.porcentajeImpuesto) }),
      ...(body.aplicaImpuestoSobre !== undefined && { aplicaImpuestoSobre: body.aplicaImpuestoSobre }),
    },
    create: {
      duenoId: session.userId,
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
      tipoTributo: body.tipoTributo || "boleta_honorarios",
      porcentajeImpuesto: body.porcentajeImpuesto !== undefined ? Number(body.porcentajeImpuesto) : 15.25,
      aplicaImpuestoSobre: body.aplicaImpuestoSobre || "pago_chofer",
    },
  });

  return NextResponse.json({ configuracion: config });
}
