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
    return NextResponse.json({ error: "Solo administradores pueden cambiar la configuración" }, { status: 403 });
  }

  const body = await req.json();

  // Validar comisiones: deben estar en [0, 100] y sumar 100 si ambas se envían
  const pctChofer = body.porcentajeComisionChofer != null ? Number(body.porcentajeComisionChofer) : undefined;
  const pctDueno = body.porcentajeComisionDueno != null ? Number(body.porcentajeComisionDueno) : undefined;
  if (pctChofer != null && (pctChofer < 0 || pctChofer > 100)) {
    return NextResponse.json({ error: "El porcentaje del chofer debe estar entre 0 y 100" }, { status: 400 });
  }
  if (pctDueno != null && (pctDueno < 0 || pctDueno > 100)) {
    return NextResponse.json({ error: "El porcentaje del dueño debe estar entre 0 y 100" }, { status: 400 });
  }
  // Validar suma=100: si solo se envía uno, obtener el otro de DB
  if (pctChofer != null || pctDueno != null) {
    const configActual = await db.configuracion.findUnique({ where: { duenoId: session.userId } });
    const choferFinal = pctChofer ?? configActual?.porcentajeComisionChofer ?? 50;
    const duenoFinal = pctDueno ?? configActual?.porcentajeComisionDueno ?? 50;
    if (Math.abs(choferFinal + duenoFinal - 100) > 0.01) {
      return NextResponse.json({ error: `Los porcentajes deben sumar 100% (actual: ${choferFinal + duenoFinal}%)` }, { status: 400 });
    }
  }

  // Validar otros campos numéricos
  const pctImpuesto = body.porcentajeImpuesto != null ? Number(body.porcentajeImpuesto) : undefined;
  if (pctImpuesto != null && (pctImpuesto < 0 || pctImpuesto > 100)) {
    return NextResponse.json({ error: "El porcentaje de impuesto debe estar entre 0 y 100" }, { status: 400 });
  }
  const capacidad = body.capacidadCamion != null ? Number(body.capacidadCamion) : undefined;
  if (capacidad != null && capacidad <= 0) {
    return NextResponse.json({ error: "La capacidad del camión debe ser mayor a 0" }, { status: 400 });
  }
  const montoUnico = body.montoPorVueltaUnicoCliente != null ? Number(body.montoPorVueltaUnicoCliente) : undefined;
  if (montoUnico != null && montoUnico < 0) {
    return NextResponse.json({ error: "El monto por vuelta (cliente único) no puede ser negativo" }, { status: 400 });
  }
  const montoMultiple = body.montoPorVueltaMultiple != null ? Number(body.montoPorVueltaMultiple) : undefined;
  if (montoMultiple != null && montoMultiple < 0) {
    return NextResponse.json({ error: "El monto por vuelta (múltiples) no puede ser negativo" }, { status: 400 });
  }
  const precioEfectivo = body.precioEfectivoPorLitro != null ? Number(body.precioEfectivoPorLitro) : undefined;
  if (precioEfectivo != null && precioEfectivo < 0) {
    return NextResponse.json({ error: "El precio efectivo por litro no puede ser negativo" }, { status: 400 });
  }
  const precioTransf = body.precioTransferenciaPorLitro != null ? Number(body.precioTransferenciaPorLitro) : undefined;
  if (precioTransf != null && precioTransf < 0) {
    return NextResponse.json({ error: "El precio transferencia por litro no puede ser negativo" }, { status: 400 });
  }
  const precioCamion = body.precioCamionCompleto != null ? Number(body.precioCamionCompleto) : undefined;
  if (precioCamion != null && precioCamion < 0) {
    return NextResponse.json({ error: "El precio por camión completo no puede ser negativo" }, { status: 400 });
  }

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
      ...(body.precioCamionCompleto !== undefined && { precioCamionCompleto: Number(body.precioCamionCompleto) }),
      ...(body.tipoTributo !== undefined && { tipoTributo: body.tipoTributo }),
      ...(body.porcentajeImpuesto !== undefined && { porcentajeImpuesto: Number(body.porcentajeImpuesto) }),
      ...(body.aplicaImpuestoSobre !== undefined && { aplicaImpuestoSobre: body.aplicaImpuestoSobre }),
      ...(body.choferesPuedenEditarClientes !== undefined && { choferesPuedenEditarClientes: !!body.choferesPuedenEditarClientes }),
      ...(body.choferesPuedenCrearPedidos !== undefined && { choferesPuedenCrearPedidos: !!body.choferesPuedenCrearPedidos }),
      ...(body.umbralCompletacionVuelta !== undefined && { umbralCompletacionVuelta: Number(body.umbralCompletacionVuelta) }),
      ...(body.periodoLiquidacion !== undefined && { periodoLiquidacion: body.periodoLiquidacion }),
      ...(body.diaCierreMes !== undefined && { diaCierreMes: Number(body.diaCierreMes) || 0 }),
      ...(body.diaCierreSemana !== undefined && { diaCierreSemana: Number(body.diaCierreSemana) || 6 }),
      // Datos de empresa
      ...(body.empresaRazonSocial !== undefined && { empresaRazonSocial: body.empresaRazonSocial?.trim() || null }),
      ...(body.empresaRut !== undefined && { empresaRut: body.empresaRut?.trim() || null }),
      ...(body.empresaDireccion !== undefined && { empresaDireccion: body.empresaDireccion?.trim() || null }),
      ...(body.empresaTelefono !== undefined && { empresaTelefono: body.empresaTelefono?.trim() || null }),
      ...(body.empresaEmail !== undefined && { empresaEmail: body.empresaEmail?.trim() || null }),
      ...(body.empresaGiro !== undefined && { empresaGiro: body.empresaGiro?.trim() || null }),
      ...(body.empresaComuna !== undefined && { empresaComuna: body.empresaComuna?.trim() || null }),
      ...(body.empresaCiudad !== undefined && { empresaCiudad: body.empresaCiudad?.trim() || null }),
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
      precioCamionCompleto: Number(body.precioCamionCompleto) || 0,
      tipoTributo: body.tipoTributo || "boleta_honorarios",
      porcentajeImpuesto: body.porcentajeImpuesto !== undefined ? Number(body.porcentajeImpuesto) : 15.25,
      aplicaImpuestoSobre: body.aplicaImpuestoSobre || "pago_chofer",
      choferesPuedenEditarClientes: body.choferesPuedenEditarClientes !== undefined ? !!body.choferesPuedenEditarClientes : false,
      choferesPuedenCrearPedidos: body.choferesPuedenCrearPedidos !== undefined ? !!body.choferesPuedenCrearPedidos : false,
      umbralCompletacionVuelta: body.umbralCompletacionVuelta !== undefined ? Number(body.umbralCompletacionVuelta) : 0.975,
      periodoLiquidacion: body.periodoLiquidacion || "mensual",
      diaCierreMes: Number(body.diaCierreMes) || 0,
      diaCierreSemana: Number(body.diaCierreSemana) || 6,
    },
  });

  return NextResponse.json({ configuracion: config });
}
