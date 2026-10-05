import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import crypto from "crypto";

// Genera un código de 6 caracteres A-Z0-9 sin caracteres ambiguos (no 0/O, no 1/I)
function generarCodigoConfirmacion(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    codigo += chars[bytes[i] % chars.length];
  }
  return codigo;
}

export async function GET() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente" && user.rol !== "superadmin") return NextResponse.json({ error: "Solo clientes" }, { status: 403 });
  const pedidos = await akuosplashDb.akuoPedidoCliente.findMany({
    where: { clienteId: user.id },
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({ pedidos });
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "cliente") return NextResponse.json({ error: "Solo clientes pueden pedir" }, { status: 403 });
  const body = await req.json();
  if (!body.direccion?.trim() || !body.litros) return NextResponse.json({ error: "Dirección y litros son obligatorios" }, { status: 400 });

  // Determinar si el pedido requiere presencia del cliente
  // Por defecto, toma la preferencia del perfil del usuario
  const requierePresencia = body.requierePresenciaCliente !== undefined
    ? !!body.requierePresenciaCliente
    : !!((user as any).requiereClientePresente);

  // Generar código solo si requiere presencia
  const codigoConfirmacion = requierePresencia ? generarCodigoConfirmacion() : null;
  const codigoGeneradoEn = requierePresencia ? new Date() : null;

  const pedido = await akuosplashDb.akuoPedidoCliente.create({
    data: {
      clienteId: user.id,
      litros: Number(body.litros) || 1000,
      direccion: body.direccion.trim(),
      comuna: body.comuna?.trim() || null,
      lat: body.lat ? Number(body.lat) : null,
      lng: body.lng ? Number(body.lng) : null,
      fechaDeseada: body.fechaDeseada ? new Date(body.fechaDeseada) : null,
      franjaHoraria: body.franjaHoraria || null,
      metodoPago: body.metodoPago || "efectivo",
      nota: body.nota?.trim() || null,
      estado: "pendiente",
      requierePresenciaCliente: requierePresencia,
      codigoConfirmacion,
      codigoGeneradoEn,
    },
  });
  return NextResponse.json({ ok: true, pedido }, { status: 201 });
}
