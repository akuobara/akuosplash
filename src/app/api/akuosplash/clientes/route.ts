import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/clientes — lista de clientes del transportista
export async function GET() {
  try {
    const user = await akuoGetCurrentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.rol !== "transportista" && user.rol !== "superadmin") {
      return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
    }
    const clientes = await akuosplashDb.akuoCliente.findMany({
      where: { transportistaId: user.id, activo: true },
      orderBy: { nombre: "asc" },
    });
    // Mapear campos para compatibilidad con el frontend de Aljibe
    return NextResponse.json({
      clientes: clientes.map(c => ({
        id: c.id, nombre: c.nombre, rut: null, direccion: c.direccion, telefono: c.telefono,
        email: null, zona: c.zona,
        precioEfectivoPorLitro: c.precioEfectivoPorLitro,
        precioTransferenciaPorLitro: c.precioTransferenciaPorLitro,
        precioCamionCompleto: 0,
        lat: c.lat, lng: c.lng,
        requiereIngresoPropiedad: c.requiereIngresoPropiedad,
        entregaDesdeAfuera: c.entregaDesdeAfuera,
        conexionExterna: c.conexionExterna,
        requiereClientePresente: true,
        indicacionesAcceso: c.indicacionesAcceso,
        usoAgua: "consumo", deudaInicial: 0, usoAguaNota: null,
        estanquesJson: c.estanquesJson, choferPreferidoId: null,
      })),
    });
  } catch (e: any) {
    console.error("[GET /api/akuosplash/clientes]", e);
    return NextResponse.json(
      { error: e?.message || "Error interno al listar clientes" },
      { status: 500 }
    );
  }
}

// POST /api/akuosplash/clientes — crear nuevo cliente
export async function POST(req: NextRequest) {
  try {
    const user = await akuoGetCurrentUser();
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (user.rol !== "transportista" && user.rol !== "superadmin") {
      return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
    }
    const body = await req.json();
    if (!body.nombre?.trim()) return NextResponse.json({ error: "Nombre obligatorio" }, { status: 400 });

    const cliente = await akuosplashDb.akuoCliente.create({
      data: {
        transportistaId: user.id,
        nombre: body.nombre.trim(),
        telefono: body.telefono || null,
        direccion: body.direccion || null,
        zona: body.zona || null,
        lat: body.lat ? Number(body.lat) : null,
        lng: body.lng ? Number(body.lng) : null,
        precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0,
        precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0,
        nota: body.nota || null,
        estanquesJson: body.estanquesJson || null,
        requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
        entregaDesdeAfuera: !!body.entregaDesdeAfuera,
        conexionExterna: !!body.conexionExterna,
        indicacionesAcceso: body.indicacionesAcceso || null,
        activo: true,
      },
    });
    return NextResponse.json({ ok: true, cliente }, { status: 201 });
  } catch (e: any) {
    console.error("[POST /api/akuosplash/clientes]", e);
    return NextResponse.json(
      { error: e?.message || "Error interno al crear cliente", stack: process.env.NODE_ENV === "development" ? e?.stack : undefined },
      { status: 500 }
    );
  }
}
