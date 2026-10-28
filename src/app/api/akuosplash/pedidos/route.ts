import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/pedidos — lista de pedidos internos del transportista
export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const pedidos = await akuosplashDb.akuoPedido.findMany({
    where: { transportistaId: user.id },
    orderBy: { creadoEn: "desc" },
    include: { cliente: { select: { id: true, nombre: true, direccion: true } } },
  });
  return NextResponse.json({ pedidos: pedidos.map(p => ({
    id: p.id, clienteNombre: p.clienteNombre, clienteId: p.clienteId,
    litrosSolicitados: p.litrosSolicitados, metodoPagoPreferido: p.metodoPagoPreferido,
    fechaSolicitada: p.fechaSolicitada?.toISOString() || null, estado: p.estado,
  })) });
}

// POST /api/akuosplash/pedidos — crear pedido
export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  const body = await req.json();
  if (!body.clienteNombre?.trim()) return NextResponse.json({ error: "Cliente obligatorio" }, { status: 400 });
  const pedido = await akuosplashDb.akuoPedido.create({
    data: {
      transportistaId: user.id,
      clienteId: body.clienteId || null,
      clienteNombre: body.clienteNombre.trim(),
      clienteDireccion: body.clienteDireccion || null,
      clienteTelefono: body.clienteTelefono || null,
      clienteZona: body.clienteZona || null,
      litrosSolicitados: Number(body.litrosSolicitados) || 1000,
      fechaSolicitada: body.fechaSolicitada ? new Date(body.fechaSolicitada) : null,
      estado: body.estado || "pendiente",
      metodoPagoPreferido: body.metodoPagoPreferido || "credito",
      nota: body.nota || null,
    },
  });
  return NextResponse.json({ ok: true, pedido }, { status: 201 });
}
