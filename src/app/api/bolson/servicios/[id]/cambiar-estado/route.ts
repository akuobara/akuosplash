// POST /api/bolson/servicios/[id]/cambiar-estado — actualiza estado del servicio
// Body: { estado, ubicacionLat?, ubicacionLng?, nota? }
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser, bolsonNotificar } from "@/lib/bolson-auth";

const FLUJO: Record<string, string[]> = {
  asignado: ["en_camino_carga", "cancelado"],
  en_camino_carga: ["cargado", "cancelado"],
  cargado: ["en_camino_entrega", "cancelado"],
  en_camino_entrega: ["entregado", "cancelado"],
  entregado: ["completado"],
  completado: [],
  cancelado: [],
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const nuevoEstado = body.estado;
  if (!nuevoEstado) return NextResponse.json({ error: "estado es obligatorio" }, { status: 400 });

  const serv = await bolsonDb.bolsonServicio.findUnique({
    where: { id },
    include: { solicitud: { select: { id: true, titulo: true, clienteId: true } } },
  });
  if (!serv) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  // Permisos: transportista del servicio, o chofer del servicio, o superadmin
  const esTransportista = serv.transportistaId === user.id;
  const esChofer = serv.choferId === user.id;
  const esSuperadmin = user.rol === "superadmin";
  if (!esTransportista && !esChofer && !esSuperadmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Cliente puede marcar entregado → completado (solo)
  const esCliente = serv.solicitud.clienteId === user.id;
  if (esCliente && !esSuperadmin) {
    if (serv.estado !== "entregado" || nuevoEstado !== "completado") {
      return NextResponse.json({ error: "Como cliente solo podés confirmar la entrega final" }, { status: 403 });
    }
  } else if (!esTransportista && !esChofer && !esSuperadmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Validar transición
  const permitidos = FLUJO[serv.estado] || [];
  if (!permitidos.includes(nuevoEstado)) {
    return NextResponse.json(
      { error: `No podés pasar de "${serv.estado}" a "${nuevoEstado}". Transiciones permitidas: ${permitidos.join(", ") || "ninguna"}` },
      { status: 400 }
    );
  }

  // Actualizar
  const data: any = { estado: nuevoEstado, notaInterna: body.nota?.trim() || serv.notaInterna };
  if (body.ubicacionLat !== undefined) {
    data.ubicacionActualLat = Number(body.ubicacionLat);
    data.ubicacionActualLng = Number(body.ubicacionLng);
    data.ubicacionActualEn = new Date();
  }
  if (nuevoEstado === "en_camino_carga" && !serv.iniciadoEn) data.iniciadoEn = new Date();
  if (nuevoEstado === "completado") data.completadoEn = new Date();
  if (nuevoEstado === "cancelado") data.canceladoEn = new Date();

  const actualizado = await bolsonDb.bolsonServicio.update({ where: { id }, data });

  // Actualizar solicitud
  if (nuevoEstado === "completado") {
    await bolsonDb.bolsonSolicitud.update({
      where: { id: serv.solicitudId },
      data: { estado: "entregada", cerradaEn: new Date() },
    });
  } else if (nuevoEstado === "cancelado") {
    await bolsonDb.bolsonSolicitud.update({
      where: { id: serv.solicitudId },
      data: { estado: "cancelada", canceladaRazon: "servicio_cancelado", cerradaEn: new Date() },
    });
  }

  // Notificar al cliente
  const mensajes: Record<string, { titulo: string; texto: string }> = {
    en_camino_carga: { titulo: "Servicio iniciado", texto: "El transportista está en camino al punto de carga." },
    cargado: { titulo: "Cargado", texto: "La mercadería fue cargada y está en ruta al destino." },
    en_camino_entrega: { titulo: "En camino a la entrega", texto: "El transportista está en camino al punto de entrega." },
    entregado: { titulo: "Entregado", texto: "El transportista marcó el servicio como entregado. Confirmá la recepción desde tu panel." },
    completado: { titulo: "Servicio completado", texto: "El servicio fue completado. ¡No te olvides de valorar al transportista!" },
    cancelado: { titulo: "Servicio cancelado", texto: "El servicio fue cancelado." },
  };
  const msg = mensajes[nuevoEstado];
  if (msg) {
    await bolsonNotificar(
      serv.solicitud.clienteId,
      "servicio_actualizado",
      msg.titulo,
      `${msg.texto} (Solicitud: "${serv.solicitud.titulo}")`,
      "/bolson/cliente",
      serv.solicitudId
    );
  }

  return NextResponse.json({ ok: true, servicio: actualizado });
}
