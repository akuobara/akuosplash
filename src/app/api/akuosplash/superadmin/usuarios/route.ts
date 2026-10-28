import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// GET /api/akuosplash/superadmin/usuarios?rol=transportista
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const rol = searchParams.get("rol") || undefined;
  const where: any = {};
  if (rol) where.rol = rol;

  const usuarios = await akuosplashDb.akuoUsuario.findMany({
    where,
    orderBy: { creadoEn: "desc" },
    select: {
      id: true, email: true, nombre: true, telefono: true, rol: true,
      aprobado: true, activo: true, banned: true, plan: true,
      creadoEn: true, ultimoLoginEn: true,
      razonSocial: true, patenteVehiculo: true, tipoVehiculo: true,
      // Datos de perfil completos (para saber si el registro está completo)
      rut: true, rutEmpresa: true, licenciaConducirUrl: true,
      licenciaConducirAtrasUrl: true, permisoCircUrl: true, seguroUrl: true, revisonTecnicaUrl: true,
      capacidadVehiculoKg: true,
      fotoVehiculoFrenteUrl: true, fotoVehiculoAtrasUrl: true,
      fotoVehiculoIzquierdaUrl: true, fotoVehiculoDerechaUrl: true,
      // Estado de aprobación granular
      estadoAprobacion: true, estadoAprobacionNota: true,
      estadoAprobacionActualizadoEn: true, estadoAprobacionActualizadoPor: true,
      areasCobertura: true,
      // MP OAuth
      mpUserId: true, mpAccessToken: true,
      // Zona asignada (para clientes)
      zonaId: true, zona: { select: { id: true, nombre: true, precioPorLitro: true } },
    },
  });

  return NextResponse.json({ usuarios });
}

// PATCH /api/akuosplash/superadmin/usuarios?id=X
// body: { aprobado?, activo?, banned?, banRazon? }
export async function PATCH(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const body = await req.json();
  const data: any = {};
  if (body.aprobado !== undefined) data.aprobado = !!body.aprobado;
  if (body.activo !== undefined) data.activo = !!body.activo;
  if (body.banned !== undefined) {
    data.banned = !!body.banned;
    if (body.banRazon !== undefined) data.banRazon = body.banRazon;
  }

  const actualizado = await akuosplashDb.akuoUsuario.update({ where: { id }, data });
  return NextResponse.json({ ok: true, usuario: { id: actualizado.id, aprobado: actualizado.aprobado, activo: actualizado.activo, banned: actualizado.banned } });
}
