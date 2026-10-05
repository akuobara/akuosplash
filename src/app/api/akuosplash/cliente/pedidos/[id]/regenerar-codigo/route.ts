import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import crypto from "crypto";

function generarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) codigo += chars[bytes[i] % chars.length];
  return codigo;
}

// POST /api/akuosplash/cliente/pedidos/[id]/regenerar-codigo
// Genera un nuevo código de confirmación (anula el anterior)
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
  if (pedido.codigoVerificadoEn) {
    return NextResponse.json({ error: "El pedido ya fue entregado y verificado" }, { status: 400 });
  }

  const nuevoCodigo = generarCodigo();
  const actualizado = await akuosplashDb.akuoPedidoCliente.update({
    where: { id },
    data: {
      codigoConfirmacion: nuevoCodigo,
      codigoGeneradoEn: new Date(),
      codigoEnviadoPorMensaje: false,
      codigoEnviadoEn: null,
    },
  });

  return NextResponse.json({ ok: true, codigo: nuevoCodigo, pedido: actualizado });
}
