import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/transportista/pedidos/[id]/verificar-entrega
// El repartidor ingresa el código para confirmar la entrega
// Body: { codigo: "ABC123", litrosEntregados?: number, montoRecibido?: number, nota?: string }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "transportista" && user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo transportistas" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { codigo } = body;
  const codigoInput = String(codigo || "").trim().toUpperCase();

  if (!codigoInput) {
    return NextResponse.json({ error: "Debe ingresar el código de confirmación" }, { status: 400 });
  }

  const pedido = await akuosplashDb.akuoPedidoCliente.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (pedido.transportistaId !== user.id) {
    return NextResponse.json({ error: "No autorizado sobre este pedido" }, { status: 403 });
  }
  if (pedido.estado !== "aceptado" && pedido.estado !== "en_ruta") {
    return NextResponse.json({ error: "El pedido no está en estado para verificar entrega" }, { status: 400 });
  }
  if (pedido.codigoVerificadoEn) {
    return NextResponse.json({ error: "Este pedido ya fue verificado" }, { status: 400 });
  }

  // Caso 1: pedido no requiere presencia — no hace falta código
  if (!pedido.requierePresenciaCliente) {
    const actualizado = await akuosplashDb.akuoPedidoCliente.update({
      where: { id },
      data: {
        estado: "entregado",
        codigoVerificadoEn: new Date(),
        codigoVerificadoPor: user.id,
      },
    });
    await akuoNotificar(
      pedido.clienteId,
      "pedido_entregado",
      "Tu pedido fue entregado",
      `El transportista ${user.nombre} confirmó la entrega de ${pedido.litros}L en ${pedido.direccion}.`,
      "/akuosplash/cliente",
    );
    return NextResponse.json({ ok: true, pedido: actualizado, mensaje: "Entrega confirmada sin código (pedido no requiere presencia del cliente)" });
  }

  // Caso 2: requiere presencia y código
  if (!pedido.codigoConfirmacion) {
    return NextResponse.json({ error: "El pedido no tiene código asignado. Pedile al cliente que lo regenere." }, { status: 400 });
  }

  if (codigoInput !== pedido.codigoConfirmacion.toUpperCase()) {
    return NextResponse.json({ error: "El código ingresado es incorrecto" }, { status: 400 });
  }

  // Código correcto — completar entrega
  const actualizado = await akuosplashDb.akuoPedidoCliente.update({
    where: { id },
    data: {
      estado: "entregado",
      codigoVerificadoEn: new Date(),
      codigoVerificadoPor: user.id,
    },
  });

  await akuoNotificar(
    pedido.clienteId,
    "pedido_entregado",
    "¡Entrega confirmada!",
    `El transportista ${user.nombre} verificó la entrega de ${pedido.litros}L en ${pedido.direccion} con código correcto.`,
    "/akuosplash/cliente",
  );

  return NextResponse.json({ ok: true, pedido: actualizado });
}
