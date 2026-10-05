import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/transportista/pedidos
// Lista pedidos disponibles (pendientes) y los pedidos asignados al transportista
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  // Pedidos disponibles: pendientes y sin transportista asignado
  const disponibles = await akuosplashDb.akuoPedidoCliente.findMany({
    where: {
      estado: "pendiente",
      transportistaId: null,
    },
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, email: true } },
    },
  });

  // Pedidos asignados a mí: en estado aceptado o en_ruta
  const asignados = await akuosplashDb.akuoPedidoCliente.findMany({
    where: {
      transportistaId: user.id,
      estado: { in: ["aceptado", "en_ruta"] },
    },
    orderBy: { creadoEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true, telefono: true, email: true, direccion: true, comuna: true, lat: true, lng: true, indicacionesAcceso: true } },
    },
  });

  // Para los asignados, NO enviar el código si requiere presencia (lo pide aparte)
  // El transportista debe recibirlo del cliente (mensaje o boca)
  const asignadosSinCodigo = asignados.map((p) => ({
    ...p,
    // No exponemos codigoConfirmacion en esta lista
    codigoConfirmacion: undefined,
  }));

  return NextResponse.json({ disponibles, asignados: asignadosSinCodigo });
}
