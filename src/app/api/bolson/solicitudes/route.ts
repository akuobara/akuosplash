// GET /api/bolson/solicitudes — lista solicitudes (filtro por estado, categoría, mias)
// POST /api/bolson/solicitudes — crear nueva solicitud con puntos A→B→C
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

export async function GET(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const categoriaId = searchParams.get("categoriaId");
  const zona = searchParams.get("zona");
  const mias = searchParams.get("mias") === "1";
  const transporteDisponible = searchParams.get("transporteDisponible") === "1"; // solo abiertas para transportistas

  const where: any = {};
  if (estado) where.estado = estado;
  else if (transporteDisponible) where.estado = "abierta";
  if (categoriaId) where.categoriaId = categoriaId;
  if (zona) {
    where.OR = [
      { zonaOrigen: { contains: zona } },
      { zonaDestino: { contains: zona } },
    ];
  }
  if (mias) where.clienteId = user.id;

  const solicitudes = await bolsonDb.bolsonSolicitud.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    include: {
      categoria: true,
      cliente: { select: { id: true, nombre: true, telefono: true, email: true } },
      puntos: { orderBy: { orden: "asc" } },
      _count: { select: { cotizaciones: true } },
    },
    take: 100,
  });

  return NextResponse.json({ solicitudes });
}

export async function POST(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "cliente" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo los clientes pueden publicar solicitudes" }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Validaciones
    if (!body.categoriaId) return NextResponse.json({ error: "Categoría es obligatoria" }, { status: 400 });
    if (!body.titulo?.trim()) return NextResponse.json({ error: "Título es obligatorio" }, { status: 400 });
    if (!body.descripcion?.trim()) return NextResponse.json({ error: "Descripción es obligatoria" }, { status: 400 });
    if (!body.puntos || !Array.isArray(body.puntos) || body.puntos.length < 2) {
      return NextResponse.json({ error: "Debe haber al menos un punto de carga y uno de entrega" }, { status: 400 });
    }
    const cargas = body.puntos.filter((p: any) => p.tipo === "carga");
    const entregas = body.puntos.filter((p: any) => p.tipo === "entrega");
    if (cargas.length === 0 || entregas.length === 0) {
      return NextResponse.json({ error: "Debe haber al menos un punto de carga y uno de entrega" }, { status: 400 });
    }

    // Crear la solicitud
    const nueva = await bolsonDb.bolsonSolicitud.create({
      data: {
        clienteId: user.id,
        categoriaId: body.categoriaId,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion.trim(),
        volumenM3: body.volumenM3 ? Number(body.volumenM3) : null,
        pesoKg: body.pesoKg ? Number(body.pesoKg) : null,
        cantidadItems: Number(body.cantidadItems) || 1,
        requiereEmbalaje: !!body.requiereEmbalaje,
        requierePersonalExtra: !!body.requierePersonalExtra,
        requiereGrua: !!body.requiereGrua,
        requiereMotoneta: !!body.requiereMotoneta,
        fotoUrl: body.fotoUrl || null,
        fechaFlexible: body.fechaFlexible !== false,
        fechaMin: body.fechaMin ? new Date(body.fechaMin) : null,
        fechaMax: body.fechaMax ? new Date(body.fechaMax) : null,
        franjaHoraria: body.franjaHoraria || null,
        zonaOrigen: cargas[0]?.comuna || cargas[0]?.direccion?.slice(0, 60) || null,
        zonaDestino: entregas[0]?.comuna || entregas[0]?.direccion?.slice(0, 60) || null,
        presupuestoMax: body.presupuestoMax ? Number(body.presupuestoMax) : null,
        metodoPagoPreferido: body.metodoPagoPreferido || null,
        estado: "abierta",
      },
      include: { categoria: true, cliente: { select: { id: true, nombre: true } } },
    });

    // Crear los puntos (carga y entrega)
    for (const p of body.puntos) {
      await bolsonDb.bolsonPunto.create({
        data: {
          solicitudId: nueva.id,
          tipo: p.tipo,
          orden: Number(p.orden) || (p.tipo === "carga" ? cargas.indexOf(p) + 1 : entregas.indexOf(p) + 1),
          direccion: String(p.direccion || "").trim(),
          comuna: p.comuna?.trim() || null,
          referencia: p.referencia?.trim() || null,
          lat: p.lat ? Number(p.lat) : null,
          lng: p.lng ? Number(p.lng) : null,
          contactoNombre: p.contactoNombre?.trim() || null,
          contactoTelefono: p.contactoTelefono?.trim() || null,
          requiereAscensor: !!p.requiereAscensor,
          piso: p.piso ? Number(p.piso) : null,
          indicacionesAcceso: p.indicacionesAcceso?.trim() || null,
        },
      });
    }

    return NextResponse.json({ solicitud: nueva }, { status: 201 });
  } catch (e) {
    console.error("Bolson crear solicitud error:", e);
    return NextResponse.json({ error: "No se pudo crear la solicitud" }, { status: 500 });
  }
}
