// POST /api/bolson/servicios/[id]/fotos — subir foto (base64 o URL)
// Body: { tipo: "carga"|"entrega"|"evidencia"|"problema", url, descripcion? }
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const tipo = body.tipo;
  const url = body.url;
  const descripcion = body.descripcion?.trim() || null;
  if (!tipo || !["carga", "entrega", "evidencia", "problema"].includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido (debe ser: carga, entrega, evidencia, problema)" }, { status: 400 });
  }
  if (!url) return NextResponse.json({ error: "url es obligatoria" }, { status: 400 });

  const serv = await bolsonDb.bolsonServicio.findUnique({ where: { id } });
  if (!serv) return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });

  const esTransportista = serv.transportistaId === user.id;
  const esChofer = serv.choferId === user.id;
  const esCliente = user.rol === "cliente" && await bolsonDb.bolsonSolicitud.findUnique({ where: { id: serv.solicitudId } }).then((s) => s?.clienteId === user.id);
  const esSuperadmin = user.rol === "superadmin";
  if (!esTransportista && !esChofer && !esCliente && !esSuperadmin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Limitar tamaño del base64 a 5MB
  if (url.startsWith("data:") && url.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen es muy grande (máx 5MB)" }, { status: 400 });
  }

  // Contar fotos existentes para asignar orden
  const count = await bolsonDb.bolsonFoto.count({ where: { servicioId: id, tipo } });

  const foto = await bolsonDb.bolsonFoto.create({
    data: {
      servicioId: id,
      tipo,
      orden: count + 1,
      url,
      descripcion,
      cargadoPorId: user.id,
    },
  });

  return NextResponse.json({ foto }, { status: 201 });
}
