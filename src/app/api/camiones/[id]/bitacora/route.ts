import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkDemoBlock } from "@/lib/demo-guard";

// GET /api/camiones/[id]/bitacora — lista las entradas de bitácora de un camión.
// Accessible por el dueño (propietario) y por choferes asignados al camión.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Verificar acceso al camión
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion) {
    return NextResponse.json({ error: "Camión no encontrado" }, { status: 404 });
  }

  if (session.role === "dueno") {
    if (camion.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else {
    // Chofer: debe estar asignado al camión
    const asignacion = await db.camionChofer.findUnique({
      where: { camionId_choferId: { camionId: id, choferId: session.userId } },
    });
    if (!asignacion) {
      return NextResponse.json({ error: "No tienes acceso a este camión" }, { status: 403 });
    }
  }

  const entradas = await db.bitacoraCamion.findMany({
    where: { camionId: id },
    orderBy: { creadoEn: "desc" },
    include: {
      autor: { select: { id: true, nombre: true, role: true } },
      resueltaPor: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ entradas });
}

// POST /api/camiones/[id]/bitacora — registra una nueva entrada en la bitácora.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Verificar acceso al camión
  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion) {
    return NextResponse.json({ error: "Camión no encontrado" }, { status: 404 });
  }

  if (session.role === "dueno") {
    if (camion.duenoId !== session.userId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else {
    const asignacion = await db.camionChofer.findUnique({
      where: { camionId_choferId: { camionId: id, choferId: session.userId } },
    });
    if (!asignacion) {
      return NextResponse.json({ error: "No tienes acceso a este camión" }, { status: 403 });
    }
  }

  try {
    const body = await req.json();

    if (!body.descripcion?.trim()) {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }

    const tipo = body.tipo?.trim() || "observacion";
    const tiposValidos = [
      // Mantenimiento
      "cambio_aceite", "cambio_filtros", "cambio_plumillas", "frenos",
      "neumaticos", "revision_tecnica",
      // Falla
      "falla_motor", "falla_frenos", "falla_electrica", "falla_hidraulica", "fuga",
      // Observación / otro
      "observacion", "otro",
      // Retrocompatibilidad
      "mantenimiento", "falla_mecanica",
    ];
    if (!tiposValidos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo no válido" }, { status: 400 });
    }

    const severidad = body.severidad?.trim() || null;
    const severidadesValidas = ["baja", "media", "alta", "critica"];
    if (severidad && !severidadesValidas.includes(severidad)) {
      return NextResponse.json({ error: "Severidad no válida" }, { status: 400 });
    }

    // Determinar severidad automática para fallas (si no viene explícita)
    let severidadFinal = severidad;
    if (!severidadFinal && (tipo.startsWith("falla_") || tipo === "fuga")) {
      severidadFinal = "media";
    }

    // Monto: opcional. Convertir a Float si viene.
    let monto: number | null = null;
    if (body.monto !== undefined && body.monto !== null && body.monto !== "") {
      const parsed = Number(body.monto);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        monto = parsed;
      }
    }

    // Kilometraje: opcional. Convertir a Int si viene.
    let kilometraje: number | null = null;
    if (body.kilometraje !== undefined && body.kilometraje !== null && body.kilometraje !== "") {
      const parsed = Number(body.kilometraje);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        kilometraje = Math.floor(parsed);
      }
    }

    // Fecha: opcional. Si no viene, usa la fecha actual.
    let fecha: Date;
    if (body.fecha) {
      const parsed = new Date(body.fecha);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Fecha no válida" }, { status: 400 });
      }
      fecha = parsed;
    } else {
      fecha = new Date();
    }

    const entrada = await db.bitacoraCamion.create({
      data: {
        camionId: id,
        autorId: session.userId,
        tipo,
        descripcion: body.descripcion.trim(),
        monto,
        fecha,
        kilometraje,
        severidad: severidadFinal,
      },
      include: {
        autor: { select: { id: true, nombre: true, role: true } },
        resueltaPor: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ entrada }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo registrar la entrada" }, { status: 500 });
  }
}

// PATCH /api/camiones/[id]/bitacora?entradaId=X — marcar como resuelta/no resuelta.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const _demoBlocked = await checkDemoBlock();
  if (_demoBlocked) return _demoBlocked;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const entradaId = searchParams.get("entradaId");
  if (!entradaId) {
    return NextResponse.json({ error: "Falta entradaId" }, { status: 400 });
  }

  // Solo el dueño puede marcar como resuelta
  if (session.role !== "dueno") {
    return NextResponse.json({ error: "Solo el dueño puede marcar entradas como resueltas" }, { status: 403 });
  }

  const camion = await db.camion.findUnique({ where: { id } });
  if (!camion || camion.duenoId !== session.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const resuelta = !!body.resuelta;

  const entrada = await db.bitacoraCamion.update({
    where: { id: entradaId, camionId: id },
    data: resuelta
      ? { resuelta: true, resueltaEn: new Date(), resueltaPorId: session.userId }
      : { resuelta: false, resueltaEn: null, resueltaPorId: null },
    include: {
      autor: { select: { id: true, nombre: true, role: true } },
      resueltaPor: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({ entrada });
}
