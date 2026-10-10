// GET /api/akuosplash/transportista/clientes — lista clientes del transportista
// POST /api/akuosplash/transportista/clientes — crea cliente nuevo
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }
  const clientes = await akuosplashDb.akuoCliente.findMany({
    where: { transportistaId: user.id },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({ clientes });
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const nombre = body.nombre?.trim();
    if (!nombre) {
      return NextResponse.json({ error: "El nombre del cliente es obligatorio" }, { status: 400 });
    }

    // Verificar duplicado por teléfono (si viene)
    const telefono = body.telefono?.trim() || null;
    if (telefono) {
      const dup = await akuosplashDb.akuoCliente.findFirst({
        where: { transportistaId: user.id, telefono },
      });
      if (dup) {
        return NextResponse.json(
          { error: "Ya tenés un cliente con ese teléfono" },
          { status: 409 }
        );
      }
    }

    const cliente = await akuosplashDb.akuoCliente.create({
      data: {
        transportistaId: user.id,
        nombre,
        telefono,
        direccion: body.direccion?.trim() || null,
        zona: body.zona?.trim() || null,
        lat: body.lat ? Number(body.lat) : null,
        lng: body.lng ? Number(body.lng) : null,
        precioEfectivoPorLitro: body.precioEfectivoPorLitro
          ? Number(body.precioEfectivoPorLitro)
          : 0,
        precioTransferenciaPorLitro: body.precioTransferenciaPorLitro
          ? Number(body.precioTransferenciaPorLitro)
          : 0,
        nota: body.nota?.trim() || null,
        estanquesJson: body.estanquesJson || null,
        requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
        entregaDesdeAfuera: !!body.entregaDesdeAfuera,
        conexionExterna: !!body.conexionExterna,
        indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, cliente });
  } catch (e) {
    console.error("AkuoSplash transportista/clientes POST error:", e);
    return NextResponse.json({ error: "No se pudo crear el cliente" }, { status: 500 });
  }
}
