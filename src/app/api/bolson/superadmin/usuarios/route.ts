// GET /api/bolson/superadmin/usuarios — lista todos los usuarios
// Query: ?rol=cliente|transportista|superadmin & ?estado=activo|inactivo|banned|pendiente
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function GET(req: NextRequest) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rol = searchParams.get("rol");
  const estado = searchParams.get("estado");

  const where: any = {};
  if (rol) where.rol = rol;
  if (estado === "activo") { where.activo = true; where.banned = false; }
  if (estado === "inactivo") { where.activo = false; }
  if (estado === "banned") { where.banned = true; }
  if (estado === "pendiente") { where.rol = "transportista"; where.aprobado = false; where.banned = false; where.activo = true; }

  const usuarios = await bolsonDb.bolsonUsuario.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    select: {
      id: true, email: true, telefono: true, nombre: true, rol: true,
      activo: true, aprobado: true, banned: true, banRazon: true,
      creadoEn: true, ultimoLoginEn: true,
      razonSocial: true, rutEmpresa: true, capacidadCamionKg: true,
      patenteCamion: true, tieneGrua: true, tieneMotoneta: true,
      areasCobertura: true, descripcionServicios: true,
      _count: {
        select: {
          solicitudes: true, cotizaciones: true, serviciosTransportista: true,
          serviciosChofer: true, fotosCargadas: true, mensajesEnviados: true,
          valoracionesRecibidas: true,
        },
      },
    },
    take: 200,
  });

  return NextResponse.json({ usuarios });
}
