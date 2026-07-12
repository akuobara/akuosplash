import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";
import { getRange } from "@/lib/helpers";

// GET /api/vueltas?period=hoy|semana|mes|todo
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
  const period = (searchParams.get("period") as "hoy" | "semana" | "mes" | "todo") || "todo";
  const { start, end } = getRange(period);

  // Filtro base por duenoId
  const where: Record<string, unknown> = {
    duenoId,
    AND: [
      start ? { iniciadaEn: { gte: start } } : {},
      end ? { iniciadaEn: { lt: end } } : {},
    ],
  };

  // Chofer: solo sus vueltas
  if (session.role === "chofer") {
    where.choferId = session.userId;
  }

  const vueltas = await db.vuelta.findMany({
    where,
    include: {
      _count: { select: { entregas: true } },
      camion: { select: { id: true, nombre: true, patente: true, capacidad: true } },
      chofer: { select: { id: true, nombre: true } },
      entregas: {
        select: {
          id: true,
          litros: true,
          total: true,
          montoRecibido: true,
          clienteNombre: true,
          metodoPago: true,
        },
      },
    },
    orderBy: { iniciadaEn: "desc" },
  });

  const vueltasCalculadas = vueltas.map((v) => {
    const numEntregas = v._count.entregas;
    const litros = v.entregas.reduce((s, e) => s + e.litros, 0);
    const ventas = v.entregas.reduce((s, e) => s + e.total, 0);
    const efectivoRecibido = v.entregas.reduce((s, e) => s + e.montoRecibido, 0);
    const capacidadCamion = v.camion?.capacidad ?? 0;
    const litrosRestantes = Math.max(0, capacidadCamion - litros);
    return {
      id: v.id,
      numero: v.numero,
      iniciadaEn: v.iniciadaEn,
      cerradaEn: v.cerradaEn,
      activa: v.activa,
      nota: v.nota,
      camion: v.camion,
      chofer: v.chofer,
      cantidadEntregas: numEntregas,
      litros,
      litrosRestantes,
      capacidadCamion,
      ventas,
      efectivoRecibido,
      esMultiple: numEntregas > 1,
    };
  });

  return NextResponse.json({ vueltas: vueltasCalculadas });
}

// POST /api/vueltas — inicia una nueva vuelta
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Cerrar la vuelta activa actual del MISMO chofer (solo puede haber una activa por chofer)
    const activaActual = await db.vuelta.findFirst({
      where: { activa: true, duenoId, choferId: session.userId },
    });
    if (activaActual) {
      await db.vuelta.update({
        where: { id: activaActual.id },
        data: { activa: false, cerradaEn: new Date() },
      });
    }

    // Determinar camión
    let camionId = body.camionId || null;
    if (!camionId) {
      // Dueño: primer camión activo suyo
      // Chofer: primer camión activo asignado a él
      if (session.role === "dueno") {
        const camionActivo = await db.camion.findFirst({
          where: { activo: true, duenoId: session.userId },
          orderBy: { creadoEn: "asc" },
        });
        camionId = camionActivo?.id ?? null;
      } else {
        const asignacion = await db.camionChofer.findFirst({
          where: { choferId: session.userId, camion: { activo: true } },
          include: { camion: true },
          orderBy: { asignadoEn: "asc" },
        });
        camionId = asignacion?.camionId ?? null;
      }
    } else {
      // Verificar que el chofer tiene acceso al camión
      if (session.role === "chofer") {
        const asignado = await db.camionChofer.findUnique({
          where: { camionId_choferId: { camionId, choferId: session.userId } },
        });
        if (!asignado) {
          return NextResponse.json({ error: "No estás asignado a este camión" }, { status: 403 });
        }
      } else {
        // Dueño: verificar propiedad
        const camion = await db.camion.findUnique({ where: { id: camionId } });
        if (!camion || camion.duenoId !== session.userId) {
          return NextResponse.json({ error: "Camión no autorizado" }, { status: 403 });
        }
      }
    }

    if (!camionId) {
      return NextResponse.json({ error: "No hay camión disponible. Pídele al dueño que te asigne uno." }, { status: 400 });
    }

    // Calcular siguiente número
    const ultima = await db.vuelta.findFirst({
      where: { duenoId },
      orderBy: { numero: "desc" },
    });
    const siguienteNumero = (ultima?.numero ?? 0) + 1;

    const nueva = await db.vuelta.create({
      data: {
        numero: siguienteNumero,
        nota: body.nota?.trim() || null,
        activa: true,
        camionId,
        choferId: session.userId,
        duenoId,
      },
      include: {
        camion: { select: { id: true, nombre: true, patente: true, capacidad: true } },
        chofer: { select: { id: true, nombre: true } },
      },
    });

    return NextResponse.json({ vuelta: nueva }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "No se pudo iniciar la vuelta" }, { status: 500 });
  }
}
