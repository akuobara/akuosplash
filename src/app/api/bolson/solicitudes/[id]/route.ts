// GET /api/bolson/solicitudes/[id] — detalle de una solicitud
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await params;
  const sol = await bolsonDb.bolsonSolicitud.findUnique({
    where: { id },
    include: {
      categoria: true,
      cliente: { select: { id: true, nombre: true, telefono: true, email: true } },
      puntos: { orderBy: { orden: "asc" } },
      cotizaciones: {
        include: {
          transportista: { select: { id: true, nombre: true, razonSocial: true, patenteCamion: true, capacidadCamionKg: true, tieneGrua: true, tieneMotoneta: true, descripcionServicios: true } },
        },
        orderBy: { creadoEn: "asc" },
      },
      servicio: {
        include: {
          transportista: { select: { id: true, nombre: true, telefono: true } },
          chofer: { select: { id: true, nombre: true, telefono: true } },
          fotos: { orderBy: { creadoEn: "asc" } },
          pagos: { orderBy: { creadoEn: "desc" } },
          valoraciones: true,
        },
      },
      mensajes: {
        include: { remitente: { select: { id: true, nombre: true } } },
        orderBy: { creadoEn: "asc" },
      },
    },
  });

  if (!sol) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Verificar permiso: cliente dueño, transportista con cotización, o superadmin
  const esDueno = sol.clienteId === user.id;
  const esTransportistaCotizante = sol.cotizaciones.some((c) => c.transportistaId === user.id);
  const esSuperadmin = user.rol === "superadmin";
  if (!esDueno && !esTransportistaCotizante && !esSuperadmin) {
    // Si está abierta, cualquier transportista aprobado puede verla
    if (sol.estado === "abierta" && user.rol === "transportista" && user.aprobado) {
      // ok
    } else {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  // Si es transportista y no es cotizante, ocultar info sensible de otros transportistas
  if (user.rol === "transportista" && !esTransportistaCotizante) {
    sol.cotizaciones = sol.cotizaciones.map((c) => ({
      ...c,
      monto: c.transportistaId === user.id ? c.monto : 0,
      mensaje: c.transportistaId === user.id ? c.mensaje : null,
    })) as any;
  }

  return NextResponse.json({ solicitud: sol });
}
