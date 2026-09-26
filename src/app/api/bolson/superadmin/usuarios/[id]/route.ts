// PATCH /api/bolson/superadmin/usuarios/[id] — ban/unban, aprobar, cambiar rol
import { NextRequest, NextResponse } from "next/server";
import { bolsonDb } from "@/lib/bolson-db";
import { bolsonGetCurrentUser } from "@/lib/bolson-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await bolsonGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const target = await bolsonDb.bolsonUsuario.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  if (target.id === user.id) return NextResponse.json({ error: "No podés modificarte a vos mismo" }, { status: 400 });

  const data: any = {};
  if (body.banned !== undefined) {
    data.banned = !!body.banned;
    data.banRazon = body.banned ? (body.banRazon?.trim() || "No especificado") : null;
  }
  if (body.activo !== undefined) data.activo = !!body.activo;
  if (body.aprobado !== undefined) data.aprobado = !!body.aprobado;
  if (body.rol && ["cliente", "transportista", "superadmin"].includes(body.rol)) data.rol = body.rol;
  if (body.nombre) data.nombre = body.nombre.trim();
  if (body.razonSocial !== undefined) data.razonSocial = body.razonSocial?.trim() || null;
  if (body.rutEmpresa !== undefined) data.rutEmpresa = body.rutEmpresa?.trim() || null;
  if (body.patenteCamion !== undefined) data.patenteCamion = body.patenteCamion?.trim() || null;
  if (body.capacidadCamionKg !== undefined) data.capacidadCamionKg = body.capacidadCamionKg ? Number(body.capacidadCamionKg) : null;
  if (body.tieneGrua !== undefined) data.tieneGrua = !!body.tieneGrua;
  if (body.tieneMotoneta !== undefined) data.tieneMotoneta = !!body.tieneMotoneta;
  if (body.areasCobertura !== undefined) data.areasCobertura = body.areasCobertura || null;
  if (body.descripcionServicios !== undefined) data.descripcionServicios = body.descripcionServicios || null;

  const actualizado = await bolsonDb.bolsonUsuario.update({ where: { id }, data });

  // Audit log
  await bolsonDb.bolsonAuditLog.create({
    data: {
      superadminId: user.id,
      accion: "modificar_usuario",
      entidad: "BolsonUsuario",
      entidadId: id,
      detalles: JSON.stringify(body),
    },
  });

  return NextResponse.json({ usuario: actualizado });
}
