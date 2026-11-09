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

  // Buscar usuario via libsql directo (Prisma findUnique puede fallar en Render)
  const { createClient } = await import("@libsql/client");
  const checkClient = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  const checkRows = await checkClient.execute({
    sql: "SELECT id, email FROM AkuoUsuario WHERE id = ?",
    args: [id],
  });
  if (checkRows.rows.length === 0) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  const targetEmail = (checkRows.rows[0] as any).email;
  if (id === user.id) {
    return NextResponse.json({ error: "No podés modificar tu propia cuenta" }, { status: 400 });
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
        `Usuario ${targetEmail} aprobado=${data.aprobado}`
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
          ? `Usuario ${targetEmail} baneado. Motivo: ${data.banRazon || "no especificado"}`
          : `Usuario ${targetEmail} desbaneado`
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
        `Usuario ${targetEmail} rol ${"?"} → ${body.rol}`
      );
    }
    if (body.vehiculosPermitidos !== undefined) {
      data.vehiculosPermitidos = Number(body.vehiculosPermitidos);
    }
    // Estado de aprobación granular (pendiente | pre_aprobado | aprobado | rechazado)
    // Permite al superadmin gestionar cuentas con marketplace cerrado / zona no disponible
    if (body.estadoAprobacion !== undefined) {
      const estadosValidos = ["pendiente", "pre_aprobado", "aprobado", "rechazado"];
      const nuevoEstado = String(body.estadoAprobacion);
      if (!estadosValidos.includes(nuevoEstado)) {
        return NextResponse.json({ error: `estadoAprobacion inválido. Valores: ${estadosValidos.join(", ")}` }, { status: 400 });
      }
      data.estadoAprobacion = nuevoEstado;
      data.estadoAprobacionNota = body.estadoAprobacionNota?.trim() || null;
      data.estadoAprobacionActualizadoEn = new Date();
      data.estadoAprobacionActualizadoPor = user.id;
      // Por compatibilidad con el campo booleano `aprobado` existente:
      // - "aprobado" y "pre_aprobado" → aprobado=true (tienen acceso al panel; el marketplace se habilita aparte)
      // - "pendiente" y "rechazado" → aprobado=false
      if (nuevoEstado === "aprobado" || nuevoEstado === "pre_aprobado") {
        data.aprobado = true;
      } else {
        data.aprobado = false;
      }
      await akuoAuditar(
        user.id,
        `cambiar_estado_aprobacion_${nuevoEstado}`,
        "AkuoUsuario",
        id,
        `Usuario ${targetEmail} estadoAprobacion=${nuevoEstado}${body.estadoAprobacionNota ? ` — nota: ${body.estadoAprobacionNota}` : ""}`
      );
      // Notificar al transportista
      const titulos: Record<string, string> = {
        pendiente: "Cuenta en revisión",
        pre_aprobado: "Cuenta pre-aprobada",
        aprobado: "Cuenta aprobada",
        rechazado: "Cuenta rechazada",
      };
      const mensajes: Record<string, string> = {
        pendiente: "Tu registro está completo. Tu cuenta está en espera de aprobación del equipo de AkuoSplash.",
        pre_aprobado: "Tu cuenta fue pre-aprobada. Vas a poder acceder al marketplace cuando esté disponible en tu zona.",
        aprobado: "¡Tu cuenta fue aprobada! Ya podés operar en el marketplace cuando esté disponible en tu zona.",
        rechazado: `Tu cuenta fue rechazada para participar del marketplace. ${body.estadoAprobacionNota ? `Motivo: ${body.estadoAprobacionNota}` : "Contactá soporte para más info."}`,
      };
      await akuosplashDb.akuoNotificacion.create({
        data: {
          usuarioId: id,
          tipo: `cuenta_${nuevoEstado}`,
          titulo: titulos[nuevoEstado] || "Estado de cuenta actualizado",
          mensaje: mensajes[nuevoEstado] || "Tu estado de cuenta fue actualizado.",
          link: "/akuosplash/transportista",
        },
      });
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

    // Construir UPDATE dinámico con libsql directo (Prisma update falla en Render)
    const { createClient } = await import("@libsql/client");
    const dbClient = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    const setParts: string[] = [];
    const values: any[] = [];

    if (data.aprobado !== undefined) { setParts.push("aprobado = ?"); values.push(data.aprobado ? 1 : 0); }
    if (data.banned !== undefined) { setParts.push("banned = ?"); values.push(data.banned ? 1 : 0); }
    if (data.banRazon !== undefined) { setParts.push("banRazon = ?"); values.push(data.banRazon); }
    if (data.activo !== undefined) { setParts.push("activo = ?"); values.push(data.activo ? 1 : 0); }
    if (data.rol !== undefined) { setParts.push("rol = ?"); values.push(data.rol); }
    if (data.plan !== undefined) { setParts.push("plan = ?"); values.push(data.plan); }
    if (data.vehiculosPermitidos !== undefined) { setParts.push("vehiculosPermitidos = ?"); values.push(data.vehiculosPermitidos); }
    if (data.estadoAprobacion !== undefined) {
      setParts.push("estadoAprobacion = ?");
      values.push(data.estadoAprobacion);
      setParts.push("estadoAprobacionNota = ?");
      values.push(data.estadoAprobacionNota || null);
      setParts.push("estadoAprobacionActualizadoEn = ?");
      values.push(new Date().toISOString());
      setParts.push("estadoAprobacionActualizadoPor = ?");
      values.push(user.id);
      // Por compatibilidad: aprobado = true si estadoAprobacion es aprobado/pre_aprobado
      if (data.estadoAprobacion === "aprobado" || data.estadoAprobacion === "pre_aprobado") {
        setParts.push("aprobado = ?"); values.push(1);
      } else {
        setParts.push("aprobado = ?"); values.push(0);
      }
    }

    if (setParts.length > 0) {
      values.push(id);
      await dbClient.execute({
        sql: `UPDATE AkuoUsuario SET ${setParts.join(", ")} WHERE id = ?`,
        args: values,
      });
    }

    // Crear notificación (opcional, no falla si no se puede)
    if (body.estadoAprobacion !== undefined) {
      const nuevoEstado = String(body.estadoAprobacion);
      const titulos: Record<string, string> = {
        pendiente: "Cuenta en revisión",
        pre_aprobado: "Cuenta pre-aprobada",
        aprobado: "Cuenta aprobada",
        rechazado: "Cuenta rechazada",
      };
      const mensajes: Record<string, string> = {
        pendiente: "Tu registro está completo. Tu cuenta está en espera de aprobación.",
        pre_aprobado: "Tu cuenta fue pre-aprobada. Vas a poder acceder al marketplace cuando esté disponible.",
        aprobado: "¡Tu cuenta fue aprobada! Ya podés operar.",
        rechazado: `Tu cuenta fue rechazada. ${body.estadoAprobacionNota ? `Motivo: ${body.estadoAprobacionNota}` : "Contactá soporte."}`,
      };
      try {
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await dbClient.execute({
          sql: "INSERT INTO AkuoNotificacion (id, usuarioId, tipo, titulo, mensaje, link, creadoEn, leida) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
          args: [notifId, id, `cuenta_${nuevoEstado}`, titulos[nuevoEstado] || "Estado actualizado", mensajes[nuevoEstado] || "", "/akuosplash/transportista", new Date().toISOString()],
        });
      } catch (e) {
        console.error("[PATCH] Notificación no creada:", (e as any)?.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("AkuoSplash superadmin/usuarios/[id] PATCH error:", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
