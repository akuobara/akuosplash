import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser, akuoNotificar } from "@/lib/akuosplash-auth";

// Código PIN simple de 4 dígitos (0-9)
function generarCodigo(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return String(n);
}

// POST /api/akuosplash/cliente/pedidos/[id]/enviar-codigo
// Envía el código de confirmación al transportista asignado por mensaje automático
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente") return NextResponse.json({ error: "Solo clientes" }, { status: 403 });

  const { id } = await params;
  const pedido = await akuosplashDb.akuoPedidoCliente.findUnique({ where: { id } });
  if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (pedido.clienteId !== user.id) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  if (!pedido.requierePresenciaCliente) {
    return NextResponse.json({ error: "Este pedido no requiere presencia del cliente" }, { status: 400 });
  }
  if (!pedido.transportistaId) {
    return NextResponse.json({ error: "El pedido aún no tiene transportista asignado" }, { status: 400 });
  }
  let codigoActual = pedido.codigoConfirmacion;
  if (!codigoActual) {
    codigoActual = generarCodigo();
    await akuosplashDb.akuoPedidoCliente.update({
      where: { id },
      data: { codigoConfirmacion: codigoActual, codigoGeneradoEn: new Date() },
    });
  }

  // Buscar o crear conversación entre cliente y transportista
  const conv = await akuosplashDb.akuoConversacion.upsert({
    where: {
      clienteId_transportistaId: {
        clienteId: user.id,
        transportistaId: pedido.transportistaId,
      },
    },
    create: { clienteId: user.id, transportistaId: pedido.transportistaId },
    update: { ultimoMensajeEn: new Date() },
  });

  // Enviar mensaje automático con el código
  const contenido = `Código de confirmación de entrega: ${codigoActual}\n\nDecime este código al llegar para confirmar la entrega del pedido de ${pedido.litros} litros en ${pedido.direccion}.`;
  await akuosplashDb.akuoMensaje.create({
    data: {
      conversacionId: conv.id,
      remitenteId: user.id,
      contenido,
    },
  });
  await akuosplashDb.akuoConversacion.update({
    where: { id: conv.id },
    data: { ultimoMensajeEn: new Date() },
  });

  // Marcar como enviado
  await akuosplashDb.akuoPedidoCliente.update({
    where: { id },
    data: {
      codigoEnviadoPorMensaje: true,
      codigoEnviadoEn: new Date(),
    },
  });

  // Notificar al transportista
  await akuoNotificar(
    pedido.transportistaId,
    "codigo_entrega",
    "Código de confirmación recibido",
    `El cliente ${user.nombre} envió el código ${codigoActual} para confirmar la entrega del pedido de ${pedido.litros}L.`,
    "/akuosplash/transportista",
  );

  return NextResponse.json({ ok: true, codigo: codigoActual, conversacionId: conv.id });
}
