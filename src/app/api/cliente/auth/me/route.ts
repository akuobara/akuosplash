import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getClienteSession } from "@/lib/auth-cliente";

// GET /api/cliente/auth/me — datos del cliente logueado
export async function GET() {
  const session = await getClienteSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const cliente = await db.clienteApp.findUnique({
    where: { id: session.clienteId },
    select: {
      id: true, nombre: true, email: true, telefono: true, rut: true,
      direccion: true,
      lat: true, lng: true,
      requiereIngresoPropiedad: true, entregaDesdeAfuera: true, conexionExterna: true,
      requiereClientePresente: true, indicacionesAcceso: true,
      usoAgua: true, usoAguaNota: true,
      estanquesJson: true,
      tiempoAceptacionPreferidoMin: true,
      entregasExitosas: true,
      saldo: true,
      activo: true,
      zona: { select: { id: true, nombre: true, precioPorLitro: true } },
      proveedorPreferido: { select: { id: true, nombre: true } },
    },
  });

  if (!cliente || !cliente.activo) {
    return NextResponse.json({ error: "Cuenta no disponible" }, { status: 403 });
  }

  // El cliente puede pagar en efectivo solo si tiene >= 10 entregas exitosas
  const puedePagarEfectivo = cliente.entregasExitosas >= 10;

  return NextResponse.json({
    cliente: {
      ...cliente,
      puedePagarEfectivo,
    },
  });
}
