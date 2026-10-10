// PATCH /api/akuosplash/superadmin/usuarios/[id]
// Acciones: banear / desbanear / aprobar / cambiar rol / activar / desactivar
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser, akuoAuditar } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }
  const { id } = await params;

  // No auto-modificarse el rol (para evitar auto-baneo accidental)
  const target = await akuosplashDb.akuoUsuario.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  if (target.id === user.id) {
    return NextResponse.json(
      { error: "No podés modificar tu propia cuenta" },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const data: Record<string, unknown> = {};

    if ("aprobado" in body) {
      data.aprobado = !!body.aprobado;
      await akuoAuditar(
        user.id,
        data.aprobado ? "aprobar_transportista" : "rechazar_transportista",
        "AkuoUsuario",
        id,
        `Usuario ${target.email} aprobado=${data.aprobado}`
      );
      // Notificar al transportista
      await akuosplashDb.akuoNotificacion.create({
        data: {
          usuarioId: id,
          tipo: data.aprobado ? "cuenta_aprobada" : "cuenta_rechazada",
          titulo: data.aprobado ? "Cuenta aprobada" : "Cuenta rechazada",
          mensaje: data.aprobado
            ? "¡Tu cuenta de transportista fue aprobada! Ya podés operar."
            : "Tu cuenta de transportista fue rechazada. Contactá soporte.",
          link: "/akuosplash/transportista",
        },
      });
    }
    if ("banned" in body) {
      data.banned = !!body.banned;
      data.banRazon = body.banRazon?.trim() || null;
      await akuoAuditar(
        user.id,
        data.banned ? "banear_usuario" : "desbanear_usuario",
        "AkuoUsuario",
        id,
        data.banned
          ? `Usuario ${target.email} baneado. Motivo: ${data.banRazon || "no especificado"}`
          : `Usuario ${target.email} desbaneado`
      );
      await akuosplashDb.akuoNotificacion.create({
        data: {
          usuarioId: id,
          tipo: data.banned ? "cuenta_baneada" : "cuenta_desbaneada",
          titulo: data.banned ? "Cuenta suspendida" : "Cuenta reactivada",
          mensaje: data.banned
            ? `Tu cuenta fue suspendida. Motivo: ${data.banRazon || "no especificado"}`
            : "Tu cuenta fue reactivada.",
          link: "/akuosplash",
        },
      });
    }
    if ("activo" in body) {
      data.activo = !!body.activo;
    }
    if (body.rol && ["cliente", "transportista", "superadmin"].includes(body.rol)) {
      data.rol = body.rol;
      await akuoAuditar(
        user.id,
        "cambiar_rol",
        "AkuoUsuario",
        id,
        `Usuario ${target.email} rol ${target.rol} → ${body.rol}`
      );
    }
    if (body.vehiculosPermitidos !== undefined) {
      data.vehiculosPermitidos = Number(body.vehiculosPermitidos);
    }
    if (body.plan && ["free", "pro", "enterprise"].includes(body.plan)) {
      data.plan = body.plan;
      // Ajustar vehiculosPermitidos según plan si no se especificó
      if (body.vehiculosPermitidos === undefined) {
        const config = await akuosplashDb.akuoConfig.findFirst({ where: { activo: true } });
        if (config) {
          if (body.plan === "free") data.vehiculosPermitidos = config.maxVehiculosFree;
          if (body.plan === "pro") data.vehiculosPermitidos = config.maxVehiculosPro;
          if (body.plan === "enterprise")
            data.vehiculosPermitidos = config.maxVehiculosEnterprise;
        }
      }
    }

    const actualizado = await akuosplashDb.akuoUsuario.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, usuario: actualizado });
  } catch (e) {
    console.error("AkuoSplash superadmin/usuarios/[id] PATCH error:", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
