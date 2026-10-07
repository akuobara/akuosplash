import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { getPeriodRange } from "@/lib/akuosplash-period";

// GET /api/akuosplash/entregas?period=hoy — lista de entregas del transportista
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "hoy";
  const { start, end } = getPeriodRange(period);

  const entregas = await akuosplashDb.akuoEntrega.findMany({
    where: {
      transportistaId: user.id,
      creadoEn: { gte: start, lte: end },
    },
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true, direccion: true, telefono: true, zona: true } },
      vuelta: { select: { id: true, numero: true } },
    },
    take: period === "todo" ? 500 : 100,
  });

  return NextResponse.json({ entregas });
}

// POST /api/akuosplash/entregas — crear nueva entrega
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const body = await req.json();

  // Validaciones básicas
  if (!body.clienteNombre?.trim()) return NextResponse.json({ error: "Cliente es obligatorio" }, { status: 400 });
  if (!body.litros || Number(body.litros) <= 0) return NextResponse.json({ error: "Litros obligatorios" }, { status: 400 });

  // Calcular total si no viene
  const litros = Number(body.litros);
  const precioPorLitro = body.precioPorLitro ? Number(body.precioPorLitro) : 0;
  const total = body.total !== undefined ? Number(body.total) : Math.round(litros * precioPorLitro);

  // Si hay vuelta activa, asociar la entrega a ella
  let vueltaId: string | null = body.vueltaId || null;
  if (!vueltaId) {
    const vueltaActiva = await akuosplashDb.akuoVuelta.findFirst({
      where: { transportistaId: user.id, activa: true, cerradaEn: null },
    });
    if (vueltaActiva) vueltaId = vueltaActiva.id;
  }

  const entrega = await akuosplashDb.akuoEntrega.create({
    data: {
      transportistaId: user.id,
      clienteId: body.clienteId || null,
      clienteNombre: body.clienteNombre.trim(),
      clienteDireccion: body.clienteDireccion || null,
      clienteTelefono: body.clienteTelefono || null,
      clienteZona: body.clienteZona || null,
      clienteLat: body.clienteLat ? Number(body.clienteLat) : null,
      clienteLng: body.clienteLng ? Number(body.clienteLng) : null,
      vehiculoId: body.vehiculoId || null,
      vueltaId,
      litros,
      total,
      montoEfectivo: Number(body.montoEfectivo) || 0,
      montoTransferencia: Number(body.montoTransferencia) || 0,
      montoRecibido: Number(body.montoRecibido) || 0,
      metodoPago: body.metodoPago || "credito",
      estadoPago: body.estadoPago || "pendiente",
      descuento: Number(body.descuento) || 0,
      descuentoPor: body.descuentoPor || null,
      fotoMedidorUrl: body.fotoMedidorUrl || null,
      nota: body.nota || null,
      detalleEstanquesJson: body.detalleEstanquesJson || null,
      lecturaAnterior: body.lecturaAnterior != null ? Number(body.lecturaAnterior) : null,
      lecturaActual: body.lecturaActual != null ? Number(body.lecturaActual) : null,
    },
  });

  return NextResponse.json({ ok: true, entrega }, { status: 201 });
}
