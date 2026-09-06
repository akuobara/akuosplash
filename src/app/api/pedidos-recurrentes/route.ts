import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// GET /api/pedidos-recurrentes
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const recurrentes = await db.pedidoRecurrente.findMany({
    where: { duenoId },
    orderBy: { fechaProximaGeneracion: "asc" },
    include: {
      cliente: {
        select: {
          id: true, nombre: true, direccion: true, telefono: true, zona: true,
          lat: true, lng: true, indicacionesAcceso: true,
        },
      },
      choferAsignado: { select: { id: true, nombre: true } },
      _count: { select: { pedidos: true } },
    },
  });

  return NextResponse.json({ recurrentes });
}

// POST /api/pedidos-recurrentes
export async function POST(req: NextRequest) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo administradores pueden crear pedidos recurrentes" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.clienteId) {
      return NextResponse.json({ error: "Cliente es obligatorio (debe ser del catálogo)" }, { status: 400 });
    }

    const cliente = await db.cliente.findUnique({ where: { id: body.clienteId } });
    if (!cliente || cliente.duenoId !== session.userId) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const frecuenciaDias = Number(body.frecuenciaDias) || 0;
    if (frecuenciaDias <= 0) {
      return NextResponse.json({ error: "La frecuencia debe ser mayor a 0 días" }, { status: 400 });
    }

    const litros = Number(body.litrosSolicitados) || 0;
    if (litros <= 0) {
      return NextResponse.json({ error: "Los litros deben ser mayores a 0" }, { status: 400 });
    }

    const fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : new Date();
    const fechaProxima = new Date(fechaInicio);

    const nuevo = await db.pedidoRecurrente.create({
      data: {
        clienteId: cliente.id,
        litrosSolicitados: litros,
        metodoPagoPreferido: body.metodoPagoPreferido || "efectivo",
        nota: body.nota?.trim() || null,
        frecuenciaDias,
        fechaInicio,
        fechaProximaGeneracion: fechaProxima,
        activo: body.activo !== false,
        asignacionTipo: body.asignacionTipo || "manual",
        choferAsignadoId: (body.choferAsignadoId && body.choferAsignadoId !== "__ninguno") ? body.choferAsignadoId : null,
        duenoId: session.userId,
      },
      include: {
        cliente: { select: { id: true, nombre: true, zona: true } },
        choferAsignado: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ recurrente: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el pedido recurrente" }, { status: 500 });
  }
}
