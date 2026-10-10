import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/vueltas/activa
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const duenoId = await getDuenoId();
  if (!duenoId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const where: Record<string, unknown> = { activa: true, duenoId };
  if (session.role === "chofer") {
    where.choferId = session.userId;
  }

  // Para dueño: si hay múltiples vueltas activas (varios choferes), devolver la más reciente.
  // Esto es determinista y evita ambigüedad.
  const activa = await db.vuelta.findFirst({
    where,
    orderBy: { iniciadaEn: "desc" },
    include: {
      camion: { select: { id: true, nombre: true, patente: true, capacidad: true } },
      chofer: { select: { id: true, nombre: true } },
      entregas: {
        select: {
          id: true,
          litros: true,
          total: true,
          montoEfectivo: true,
          montoTransferencia: true,
          montoRecibido: true,
          clienteId: true,
          clienteNombre: true,
          clienteDireccion: true,
          clienteZona: true,
          clienteTelefono: true,
          metodoPago: true,
          estadoPago: true,
          fecha: true,
          fotoMedidorUrl: true,
          cliente: { select: { lat: true, lng: true } },
        },
        orderBy: { fecha: "asc" },
      },
    },
  });

  if (!activa) {
    return NextResponse.json({ vuelta: null }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    });
  }

  const litros = activa.entregas.reduce((s, e) => s + e.litros, 0);
  const ventas = activa.entregas.reduce((s, e) => s + e.total, 0);
  const efectivoRecibido = activa.entregas.reduce((s, e) => s + e.montoEfectivo, 0);
  const transferencia = activa.entregas.reduce((s, e) => s + e.montoTransferencia, 0);
  const capacidadCamion = activa.camion?.capacidad ?? 0;
  const litrosRestantes = Math.max(0, capacidadCamion - litros);

  return NextResponse.json({
    vuelta: {
      id: activa.id,
      numero: activa.numero,
      iniciadaEn: activa.iniciadaEn,
      nota: activa.nota,
      camion: activa.camion,
      chofer: activa.chofer,
      cantidadEntregas: activa.entregas.length,
      litros,
      litrosRestantes,
      capacidadCamion,
      ventas,
      efectivoRecibido,
      transferenciaRecibida: transferencia,
      entregas: activa.entregas,
    },
  }, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
  });
}
