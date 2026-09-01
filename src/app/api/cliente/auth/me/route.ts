import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// GET /api/cliente/auth/me — datos del cliente logueado
export async function GET() {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cliente = await db.cliente.findUnique({
    where: { id: session.clienteId },
    select: {
      id: true, nombre: true, email: true, telefono: true, rut: true,
      direccion: true, zona: true,
      lat: true, lng: true,
      requiereIngresoPropiedad: true, entregaDesdeAfuera: true, conexionExterna: true,
      requiereClientePresente: true, indicacionesAcceso: true,
      usoAgua: true, usoAguaNota: true,
      estanquesJson: true,
      precioEfectivoPorLitro: true, precioTransferenciaPorLitro: true,
      activo: true,
      dueno: { select: { id: true, nombre: true } },
    },
  });

  if (!cliente || !cliente.activo) {
    return NextResponse.json({ error: "Cuenta no disponible" }, { status: 403 });
  }

  return NextResponse.json({ cliente });
}
