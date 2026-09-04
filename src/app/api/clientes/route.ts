import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/clientes
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clientes = await db.cliente.findMany({
    where: { duenoId },
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { entregas: true } },
      entregas: {
        select: { total: true, montoRecibido: true },
      },
      pagos: {
        select: { monto: true },
      },
    },
  });

  // Calcular deuda por cliente: deudaInicial + ventas - recibido - pagos sueltos
  const clientesConDeuda = clientes.map(c => {
    const totalVentas = c.entregas.reduce((s, e) => s + (e.total || 0), 0);
    const totalRecibido = c.entregas.reduce((s, e) => s + (e.montoRecibido || 0), 0);
    const totalPagos = c.pagos.reduce((s, p) => s + (p.monto || 0), 0);
    const deuda = (c as any).deudaInicial + totalVentas - totalRecibido - totalPagos;
    // No devolver las entregas/pagos completos al frontend (pesado), solo el resumen
    const { entregas, pagos, ...resto } = c;
    return {
      ...resto,
      deuda: Math.round(deuda * 100) / 100, // redondear a 2 decimales
    };
  });

  return NextResponse.json({ clientes: clientesConDeuda });
}

// Helper: ¿el chofer actual tiene permiso para editar clientes?
async function choferPuedeEditarClientes(duenoId: string): Promise<boolean> {
  const config = await db.configuracion.findUnique({ where: { duenoId } });
  return !!config?.choferesPuedenEditarClientes;
}

// POST /api/clientes
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Si es chofer, verificar permiso
  if (session.role === "chofer") {
    const permitido = await choferPuedeEditarClientes(duenoId);
    if (!permitido) {
      return NextResponse.json(
        { error: "No tienes permiso para crear clientes. Pídele al administrador que habilite esta opción." },
        { status: 403 }
      );
    }
  }

  const body = await req.json();

  // Si el cliente no trae precios propios, heredar los del admin (config)
  let precioEfectivo = Number(body.precioEfectivoPorLitro) || 0;
  let precioTransferencia = Number(body.precioTransferenciaPorLitro) || 0;
  let precioCamionCompleto = Number(body.precioCamionCompleto) || 0;
  if (precioEfectivo === 0 || precioTransferencia === 0 || precioCamionCompleto === 0) {
    const config = await db.configuracion.findUnique({
      where: { duenoId },
      select: { precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true, precioCamionCompleto: true },
    });
    if (config) {
      if (precioEfectivo === 0) precioEfectivo = config.precioEfectivoPorLitro;
      if (precioTransferencia === 0) precioTransferencia = config.precioTransferenciaPorLitro;
      if (precioCamionCompleto === 0) precioCamionCompleto = config.precioCamionCompleto;
    }
  }

  const nuevo = await db.cliente.create({
    data: {
      nombre: body.nombre?.trim() || "Sin nombre",
      rut: body.rut?.trim() || null,
      direccion: body.direccion?.trim() || null,
      telefono: body.telefono?.trim() || null,
      email: body.email?.trim() || null,
      zona: body.zona?.trim() || null,
      precioEfectivoPorLitro: precioEfectivo,
      precioTransferenciaPorLitro: precioTransferencia,
      precioCamionCompleto,
      nota: body.nota?.trim() || null,
      lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
      lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
      requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
      entregaDesdeAfuera: !!body.entregaDesdeAfuera,
      conexionExterna: !!body.conexionExterna,
      requiereClientePresente: body.requiereClientePresente !== undefined ? !!body.requiereClientePresente : true,
      indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
      usoAgua: body.usoAgua || "consumo",
      usoAguaNota: body.usoAguaNota?.trim() || null,
      estanquesJson: body.estanquesJson || null,
      choferPreferidoId: (body.choferPreferidoId && body.choferPreferidoId !== "__ninguno") ? body.choferPreferidoId : null,
      duenoId,
    },
  });

  return NextResponse.json({ cliente: nuevo }, { status: 201 });
}
