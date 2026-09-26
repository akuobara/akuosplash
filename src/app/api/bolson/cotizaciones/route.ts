// GET /api/bolson/cotizaciones?mias=1 — lista mis cotizaciones
// POST /api/bolson/cotizaciones — crear cotización (transportista)
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function GET(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mias = searchParams.get("mias") === "1";
  const estado = searchParams.get("estado");
  const solicitudId = searchParams.get("solicitudId");

  const where: any = {};
  if (mias) where.transportistaId = user.id;
  if (estado) where.estado = estado;
  if (solicitudId) where.solicitudId = solicitudId;

  const cotizaciones = await bolsonDb.bolsonCotizacion.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    include: {
      solicitud: {
        select: {
          id: true, titulo: true, descripcion: true, categoria: true,
          zonaOrigen: true, zonaDestino: true, estado: true,
          cliente: { select: { id: true, nombre: true, telefono: true } },
        },
      },
      transportista: { select: { id: true, nombre: true, razonSocial: true, capacidadCamionKg: true, patenteCamion: true } },
    },
    take: 100,
  });

  return NextResponse.json({ cotizaciones });
}

export async function POST(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo los transportistas pueden cotizar" }, { status: 403 });
  }
  if (user.rol === "transportista" && !user.aprobado) {
    return NextResponse.json({ error: "Tu cuenta de transportista no fue aprobada todavía por el superadmin" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const solicitudId = body.solicitudId;
    const monto = Number(body.monto);
    if (!solicitudId) return NextResponse.json({ error: "solicitudId es obligatorio" }, { status: 400 });
    if (!monto || monto <= 0) return NextResponse.json({ error: "monto debe ser positivo" }, { status: 400 });

    // Verificar que la solicitud está abierta
    const sol = await bolsonDb.bolsonSolicitud.findUnique({ where: { id: solicitudId } });
    if (!sol) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
    if (sol.estado !== "abierta") return NextResponse.json({ error: "La solicitud no está abierta a cotizaciones" }, { status: 400 });
    if (sol.clienteId === user.id) return NextResponse.json({ error: "No podés cotizar tu propia solicitud" }, { status: 400 });

    // No permitir cotización duplicada (una por transportista por solicitud)
    const existente = await bolsonDb.bolsonCotizacion.findUnique({
      where: { solicitudId_transportistaId: { solicitudId, transportistaId: user.id } },
    });
    if (existente) return NextResponse.json({ error: "Ya cotizaste esta solicitud. Podés editar o retirar la cotización existente." }, { status: 400 });

    const nueva = await bolsonDb.bolsonCotizacion.create({
      data: {
        solicitudId,
        transportistaId: user.id,
        monto,
        tiempoEstimadoHoras: body.tiempoEstimadoHoras ? Number(body.tiempoEstimadoHoras) : null,
        fechaPropuestaInicio: body.fechaPropuestaInicio ? new Date(body.fechaPropuestaInicio) : null,
        fechaPropuestaFin: body.fechaPropuestaFin ? new Date(body.fechaPropuestaFin) : null,
        mensaje: body.mensaje?.trim() || null,
        incluyePersonal: !!body.incluyePersonal,
        incluyeEmbalaje: !!body.incluyeEmbalaje,
        incluyeGrua: !!body.incluyeGrua,
        incluyeMotoneta: !!body.incluyeMotoneta,
        estado: "pendiente",
      },
      include: {
        solicitud: { select: { clienteId: true, titulo: true } },
        transportista: { select: { id: true, nombre: true } },
      },
    });

    // Notificar al cliente
    await bolsonNotificar(
      nueva.solicitud.clienteId,
      "nueva_cotizacion",
      "Nueva cotización recibida",
      `Recibiste una cotización de $${monto} de ${nueva.transportista.nombre} para "${nueva.solicitud.titulo}".`,
      `/bolson/cliente`,
      solicitudId
    );

    return NextResponse.json({ cotizacion: nueva }, { status: 201 });
  } catch (e) {
    console.error("Bolson crear cotización error:", e);
    return NextResponse.json({ error: "No se pudo crear la cotización" }, { status: 500 });
  }
}
