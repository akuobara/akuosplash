import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/pedidos-recurrentes — lista de pedidos recurrentes
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  
  try {
    const recurrentes = await akuosplashDb.akuoPedidoRecurrente.findMany({
      where: { transportistaId: user.id, activo: true },
      include: {
        cliente: { select: { id: true, nombre: true, direccion: true, telefono: true, zona: true, lat: true, lng: true } },
      },
      orderBy: { fechaProximaGeneracion: "asc" },
    });
    return NextResponse.json({ recurrentes });
  } catch (e) {
    console.error("GET pedidos-recurrentes:", e);
    return NextResponse.json({ recurrentes: [] });
  }
}

// POST /api/akuosplash/pedidos-recurrentes — crear pedido recurrente
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  
  try {
    const body = await req.json();
    if (!body.clienteId || !body.litrosSolicitados || !body.frecuenciaDias) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }
    
    const fechaInicio = body.fechaInicio ? new Date(body.fechaInicio) : new Date();
    const fechaProxima = body.fechaProximaGeneracion ? new Date(body.fechaProximaGeneracion) : fechaInicio;
    
    const recurrente = await akuosplashDb.akuoPedidoRecurrente.create({
      data: {
        transportistaId: user.id,
        clienteId: body.clienteId,
        litrosSolicitados: Number(body.litrosSolicitados),
        metodoPagoPreferido: body.metodoPagoPreferido || "credito",
        nota: body.nota || null,
        frecuenciaDias: Number(body.frecuenciaDias),
        fechaInicio,
        fechaProximaGeneracion: fechaProxima,
        activo: true,
        diaSemanaPreferido: body.diaSemanaPreferido != null ? Number(body.diaSemanaPreferido) : null,
        asignacionTipo: body.asignacionTipo || "manual",
      },
    });
    return NextResponse.json({ ok: true, pedidoRecurrente: recurrente }, { status: 201 });
  } catch (e: any) {
    console.error("POST pedidos-recurrentes:", e);
    return NextResponse.json({ error: e?.message || "No se pudo crear" }, { status: 500 });
  }
}
