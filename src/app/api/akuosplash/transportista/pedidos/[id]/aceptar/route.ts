import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/transportista/pedidos/[id]/aceptar
// El transportista acepta un pedido disponible
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { id } = await params;
  const pedido = await akuosplashDb.akuoPedidoCliente.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (pedido.estado !== "pendiente" || pedido.transportistaId) {
    return NextResponse.json({ error: "El pedido ya fue tomado por otro transportista" }, { status: 400 });
  }

  const actualizado = await akuosplashDb.akuoPedidoCliente.update({
    where: { id },
    data: {
      transportistaId: user.id,
      estado: "aceptado",
    },
  });

  // Notificar al cliente
  await akuoNotificar(
    pedido.clienteId,
    "pedido_aceptado",
    "Tu pedido fue aceptado",
    `El repartidor ${user.nombre} aceptó tu pedido de ${pedido.litros}L. Pronto se pondrá en ruta.`,
    "/akuosplash/cliente",
  );

  return NextResponse.json({ ok: true, pedido: actualizado });
}
