import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/pedidos?estado=pendiente&clienteId=...
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const clienteId = searchParams.get("clienteId");

  const where: Record<string, unknown> = { duenoId };
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;

  // Choferes solo ven pedidos que ellos tomaron o que están pendientes/programados
  if (session.role === "chofer") {
    where.OR = [
      { choferId: session.userId },
      { choferId: null }, // pedidos sin chofer asignado
    ];
  }

  const pedidos = await db.pedido.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          direccion: true,
          telefono: true,
          zona: true,
          lat: true,
          lng: true,
          requiereIngresoPropiedad: true,
          entregaDesdeAfuera: true,
          conexionExterna: true,
          requiereClientePresente: true,
          indicacionesAcceso: true,
        },
      },
      chofer: { select: { id: true, nombre: true } },
      entrega: { select: { id: true, litros: true, total: true, fecha: true } },
      vuelta: { select: { id: true, numero: true } },
    },
  });

  return NextResponse.json({ pedidos });
}

// POST /api/pedidos — crear un pedido nuevo
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verificar permiso para choferes
  if (session.role === "chofer") {
    const config = await db.configuracion.findUnique({ where: { duenoId } });
    if (!config?.choferesPuedenCrearPedidos) {
      return NextResponse.json(
        { error: "No tienes permiso para crear pedidos. Pídele al dueño que habilite esta opción." },
        { status: 403 }
      );
    }
  }

  try {
    const body = await req.json();

    // Si es cliente existente, autollenar datos
    let clienteData: Record<string, unknown> = {};
    if (body.clienteId && body.clienteId !== "__nuevo") {
      const cliente = await db.cliente.findUnique({ where: { id: body.clienteId } });
      if (!cliente || cliente.duenoId !== duenoId) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
      clienteData = {
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        clienteDireccion: cliente.direccion,
        clienteTelefono: cliente.telefono,
        clienteZona: cliente.zona,
        clienteLat: cliente.lat,
        clienteLng: cliente.lng,
        indicacionesAcceso: cliente.indicacionesAcceso,
      };
    } else {
      // Cliente nuevo — usar datos del formulario
      clienteData = {
        clienteId: null,
        clienteNombre: body.clienteNombre?.trim() || "Sin nombre",
        clienteDireccion: body.clienteDireccion?.trim() || null,
        clienteTelefono: body.clienteTelefono?.trim() || null,
        clienteZona: body.clienteZona?.trim() || null,
        clienteLat: body.clienteLat != null && body.clienteLat !== "" ? Number(body.clienteLat) : null,
        clienteLng: body.clienteLng != null && body.clienteLng !== "" ? Number(body.clienteLng) : null,
        indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
      };
    }

    const nuevo = await db.pedido.create({
      data: {
        ...clienteData,
        litrosSolicitados: Number(body.litrosSolicitados) || 0,
        fechaSolicitada: body.fechaSolicitada ? new Date(body.fechaSolicitada) : null,
        metodoPagoPreferido: body.metodoPagoPreferido || "efectivo",
        nota: body.nota?.trim() || null,
        estado: body.estado || "pendiente",
        choferId: session.userId,
        duenoId,
      },
      include: {
        cliente: { select: { id: true, nombre: true, zona: true, lat: true, lng: true } },
        chofer: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ pedido: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
  }
}
