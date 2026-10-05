import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const conversacionId = searchParams.get("conversacionId");
  
  if (conversacionId) {
    // Verificar que el usuario es parte de la conversación
    const conv = await akuosplashDb.akuoConversacion.findUnique({ where: { id: conversacionId } });
    if (!conv || (conv.clienteId !== user.id && conv.transportistaId !== user.id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const mensajes = await akuosplashDb.akuoMensaje.findMany({
      where: { conversacionId },
      orderBy: { creadoEn: "asc" },
      include: { remitente: { select: { id: true, nombre: true } } },
    });
    return NextResponse.json({ mensajes });
  }
  
  // Listar conversaciones del usuario
  const conversaciones = await akuosplashDb.akuoConversacion.findMany({
    where: { OR: [{ clienteId: user.id }, { transportistaId: user.id }] },
    orderBy: { ultimoMensajeEn: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      transportista: { select: { id: true, nombre: true, razonSocial: true } },
      mensajes: { orderBy: { creadoEn: "desc" }, take: 1 },
    },
  });
  return NextResponse.json({ conversaciones });
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json();
  const { conversacionId, contenido, destinatarioId } = body;
  
  if (!contenido?.trim()) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  
  // Buscar o crear conversación
  let conv;
  if (conversacionId) {
    conv = await akuosplashDb.akuoConversacion.findUnique({ where: { id: conversacionId } });
    if (!conv || (conv.clienteId !== user.id && conv.transportistaId !== user.id)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  } else if (destinatarioId) {
    // Crear nueva conversación
    const destinatario = await akuosplashDb.akuoUsuario.findUnique({ where: { id: destinatarioId } });
    if (!destinatario) return NextResponse.json({ error: "Destinatario no encontrado" }, { status: 404 });
    
    // Determinar quién es cliente y quién transportista
    const clienteId = user.rol === "cliente" ? user.id : destinatarioId;
    const transportistaId = user.rol === "transportista" ? user.id : destinatarioId;
    
    conv = await akuosplashDb.akuoConversacion.upsert({
      where: { clienteId_transportistaId: { clienteId, transportistaId } },
      create: { clienteId, transportistaId },
      update: {},
    });
  } else {
    return NextResponse.json({ error: "Falta conversacionId o destinatarioId" }, { status: 400 });
  }
  
  const mensaje = await akuosplashDb.akuoMensaje.create({
    data: { conversacionId: conv.id, remitenteId: user.id, contenido: contenido.trim() },
  });
  await akuosplashDb.akuoConversacion.update({
    where: { id: conv.id },
    data: { ultimoMensajeEn: new Date() },
  });
  
  return NextResponse.json({ ok: true, mensaje, conversacionId: conv.id }, { status: 201 });
}
