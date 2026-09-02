import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// GET /api/super-admin/facturas — lista todas las facturas
export async function GET(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;

  const facturas = await db.facturaAdmin.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    take: 100,
    include: {
      dueno: { select: { id: true, nombre: true, email: true } },
    },
  });
  return NextResponse.json({ facturas });
}

// POST /api/super-admin/facturas — generar factura para un admin por un período
export async function POST(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { duenoId, periodoStart, periodoEnd } = body;

  if (!duenoId || !periodoStart || !periodoEnd) {
    return NextResponse.json({ error: "duenoId, periodoStart y periodoEnd son obligatorios" }, { status: 400 });
  }

  const start = new Date(periodoStart);
  const end = new Date(periodoEnd);

  // Buscar todos los PedidoApp entregados por el admin en el período
  const pedidos = await db.pedidoApp.findMany({
    where: {
      entregadoEn: { gte: start, lt: end },
      tomadoPor: { duenoId },
      estado: "entregado",
    },
    select: { id: true, monto: true, comisionApp: true, montoProveedor: true, entregadoEn: true },
  });

  if (pedidos.length === 0) {
    return NextResponse.json({ error: "No hay pedidos entregados para este admin en el período" }, { status: 400 });
  }

  const totalVentas = pedidos.reduce((s, p) => s + p.montoProveedor, 0);
  const comisionApp = pedidos.reduce((s, p) => s + p.comisionApp, 0);
  const montoFacturado = totalVentas; // el admin factura el 90% (lo que recibe)

  // Verificar que no exista ya una factura para este admin y período
  const existente = await db.facturaAdmin.findFirst({
    where: { duenoId, periodoStart: start, periodoEnd: end },
  });
  if (existente) {
    return NextResponse.json({ error: "Ya existe una factura para este período", factura: existente }, { status: 409 });
  }

  const factura = await db.facturaAdmin.create({
    data: {
      periodoStart: start,
      periodoEnd: end,
      duenoId,
      totalVentas,
      comisionApp,
      montoFacturado,
      montoPagado: 0,
      saldoPendiente: montoFacturado,
      estado: "pendiente",
      pedidosJson: JSON.stringify(pedidos.map(p => ({ id: p.id, monto: p.monto, montoProveedor: p.montoProveedor, comisionApp: p.comisionApp, entregadoEn: p.entregadoEn }))),
    },
  });

  return NextResponse.json({ factura }, { status: 201 });
}
