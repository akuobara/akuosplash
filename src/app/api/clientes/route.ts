import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/clientes
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const clientes = await db.cliente.findMany({
    where: { duenoId },
    orderBy: { nombre: "asc" },
    include: { _count: { select: { entregas: true } } },
  });
  return NextResponse.json({ clientes });
}

// Helper: ¿el chofer actual tiene permiso para editar clientes?
async function choferPuedeEditarClientes(duenoId: string): Promise<boolean> {
  const config = await db.configuracion.findUnique({ where: { duenoId } });
  return !!config?.choferesPuedenEditarClientes;
}

// POST /api/clientes
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Si es chofer, verificar permiso
  if (session.role === "chofer") {
    const permitido = await choferPuedeEditarClientes(duenoId);
    if (!permitido) {
      return NextResponse.json(
        { error: "No tienes permiso para crear clientes. Pídele al dueño que habilite esta opción." },
        { status: 403 }
      );
    }
  }

  const body = await req.json();

  const nuevo = await db.cliente.create({
    data: {
      nombre: body.nombre?.trim() || "Sin nombre",
      rut: body.rut?.trim() || null,
      direccion: body.direccion?.trim() || null,
      telefono: body.telefono?.trim() || null,
      email: body.email?.trim() || null,
      zona: body.zona?.trim() || null,
      precioEfectivoPorLitro: Number(body.precioEfectivoPorLitro) || 0,
      precioTransferenciaPorLitro: Number(body.precioTransferenciaPorLitro) || 0,
      nota: body.nota?.trim() || null,
      lat: body.lat != null && body.lat !== "" ? Number(body.lat) : null,
      lng: body.lng != null && body.lng !== "" ? Number(body.lng) : null,
      requiereIngresoPropiedad: !!body.requiereIngresoPropiedad,
      entregaDesdeAfuera: !!body.entregaDesdeAfuera,
      conexionExterna: !!body.conexionExterna,
      requiereClientePresente: body.requiereClientePresente !== undefined ? !!body.requiereClientePresente : true,
      indicacionesAcceso: body.indicacionesAcceso?.trim() || null,
      usoAgua: body.usoAgua || "consumo",
      usoAguaNota: body.usoAguaNota?.trim() || null,
      estanquesJson: body.estanquesJson || null,
      choferPreferidoId: (body.choferPreferidoId && body.choferPreferidoId !== "__ninguno") ? body.choferPreferidoId : null,
      duenoId,
    },
  });

  return NextResponse.json({ cliente: nuevo }, { status: 201 });
}
