import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/pedidos?estado=...&clienteId=...&disponibles=true
// - Dueño: ve todos sus pedidos
// - Chofer: ve pedidos asignados a él + publicados (sin asignar) + los que él creó
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
  const soloDisponibles = searchParams.get("disponibles") === "true";

  const where: Record<string, unknown> = { duenoId };
  if (estado) where.estado = estado;
  if (clienteId) where.clienteId = clienteId;

  if (session.role === "chofer") {
    // Choferes ven:
    // - Pedidos asignados a ellos (choferAsignadoId = su id)
    // - Pedidos publicados sin tomar (asignacionTipo = "publicado" AND tomadoPorChoferId IS NULL)
    // - Pedidos que ellos crearon
    // - Pedidos donde tienen prioridad
    if (soloDisponibles) {
      // Solo pedidos disponibles para tomar (publicados y sin tomar)
      where.AND = [
        { asignacionTipo: "publicado" },
        { tomadoPorChoferId: null },
        { estado: { in: ["pendiente", "programado"] } },
      ];
    } else {
      where.OR = [
        { choferAsignadoId: session.userId },
        { tomadoPorChoferId: session.userId },
        { choferId: session.userId },
        { prioridadChoferId: session.userId },
        {
          AND: [
            { asignacionTipo: "publicado" },
            { tomadoPorChoferId: null },
          ],
        },
      ];
    }
  } else if (soloDisponibles) {
    // Dueño pidió "disponibles": pedidos publicados sin tomar
    where.AND = [
      { asignacionTipo: "publicado" },
      { tomadoPorChoferId: null },
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
          choferPreferidoId: true,
        },
      },
      chofer: { select: { id: true, nombre: true } },
      choferAsignado: { select: { id: true, nombre: true } },
      tomadoPorChofer: { select: { id: true, nombre: true } },
      prioridadChofer: { select: { id: true, nombre: true } },
      entrega: {
        select: {
          id: true,
          litros: true,
          total: true,
          fecha: true,
          vuelta: { select: { id: true, numero: true } },
        },
      },
      vuelta: { select: { id: true, numero: true } },
    },
  });

  return NextResponse.json({ pedidos });
}

// POST /api/pedidos
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
    let clienteId: string | null = null;
    if (body.clienteId && body.clienteId !== "__nuevo") {
      const cliente = await db.cliente.findUnique({ where: { id: body.clienteId } });
      if (!cliente || cliente.duenoId !== duenoId) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
      clienteId = cliente.id;
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
      // Cliente nuevo
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

    // === Lógica de asignación ===
    let asignacionTipo = body.asignacionTipo || "manual";
    let choferAsignadoId: string | null = null;
    let prioridadChoferId: string | null = null;
    let prioridadTipo = "ninguna";
    let publicadoEn: Date | null = null;

    // Si el cliente tiene choferPreferido, asignar prioridad permanente a ese chofer
    if (clienteId) {
      const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
      if (cliente?.choferPreferidoId) {
        prioridadChoferId = cliente.choferPreferidoId;
        prioridadTipo = "permanente";
      }
    }

    // Si el chofer crea el pedido y el cliente es nuevo, tiene prioridad permanente
    if (session.role === "chofer" && !clienteId) {
      prioridadChoferId = session.userId;
      prioridadTipo = "permanente";
    }

    // Si el chofer crea el pedido para un cliente existente que ya tiene choferPreferido, respetar eso
    if (session.role === "chofer" && clienteId) {
      const cliente = await db.cliente.findUnique({ where: { id: clienteId } });
      if (cliente?.choferPreferidoId && cliente.choferPreferidoId !== session.userId) {
        // El cliente tiene otro chofer preferido — asignar a ese chofer
        choferAsignadoId = cliente.choferPreferidoId;
        asignacionTipo = "manual";
      } else if (cliente?.choferPreferidoId === session.userId) {
        // El chofer es el preferido del cliente — asignar a él
        choferAsignadoId = session.userId;
        asignacionTipo = "manual";
      }
    }

    // Dueño puede elegir asignación
    if (session.role === "dueno") {
      if (asignacionTipo === "manual") {
        choferAsignadoId = body.choferAsignadoId || null;
      } else if (asignacionTipo === "publicado") {
        publicadoEn = new Date();
      }
    }

    const nuevo = await db.pedido.create({
      data: {
        ...clienteData,
        litrosSolicitados: Number(body.litrosSolicitados) || 0,
        fechaSolicitada: body.fechaSolicitada ? new Date(body.fechaSolicitada + ":00-04:00") : null,
        metodoPagoPreferido: body.metodoPagoPreferido || "efectivo",
        nota: body.nota?.trim() || null,
        estado: body.estado || "pendiente",
        choferId: session.userId,
        duenoId,
        asignacionTipo,
        choferAsignadoId,
        prioridadChoferId,
        prioridadTipo,
        publicadoEn,
      },
      include: {
        cliente: { select: { id: true, nombre: true, zona: true, lat: true, lng: true } },
        chofer: { select: { id: true, nombre: true } },
        choferAsignado: { select: { id: true, nombre: true } },
        prioridadChofer: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ pedido: nuevo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
  }
}
