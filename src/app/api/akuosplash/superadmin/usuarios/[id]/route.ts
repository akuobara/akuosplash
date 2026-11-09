// PATCH /api/akuosplash/superadmin/usuarios/[id]
// Acciones: aprobar / banear / activar / cambiar rol / estadoAprobacion
import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

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

  // Buscar usuario via libsql directo
  const { createClient } = await import("@libsql/client");
  const dbClient = createClient({
    url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  const checkRows = await dbClient.execute({
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

    // Construir UPDATE dinámico
    const setParts: string[] = [];
    const values: any[] = [];
    let notifTipo = "";
    let notifTitulo = "";
    let notifMensaje = "";

    if ("aprobado" in body) {
      const aprobado = !!body.aprobado;
      setParts.push("aprobado = ?"); values.push(aprobado ? 1 : 0);
      notifTipo = aprobado ? "cuenta_aprobada" : "cuenta_rechazada";
      notifTitulo = aprobado ? "Cuenta aprobada" : "Cuenta rechazada";
      notifMensaje = aprobado ? "¡Tu cuenta fue aprobada! Ya podés operar." : "Tu cuenta fue rechazada. Contactá soporte.";
    }

    if ("banned" in body) {
      setParts.push("banned = ?"); values.push(body.banned ? 1 : 0);
      setParts.push("banRazon = ?"); values.push(body.banRazon?.trim() || null);
      notifTipo = body.banned ? "cuenta_baneada" : "cuenta_desbaneada";
      notifTitulo = body.banned ? "Cuenta suspendida" : "Cuenta reactivada";
      notifMensaje = body.banned ? `Cuenta suspendida. Motivo: ${body.banRazon || "no especificado"}` : "Tu cuenta fue reactivada.";
    }

    if ("activo" in body) {
      setParts.push("activo = ?"); values.push(body.activo ? 1 : 0);
    }

    if (body.rol) {
      setParts.push("rol = ?"); values.push(body.rol);
    }

    // Estado de aprobación granular
    if (body.estadoAprobacion !== undefined) {
      const estados = ["pendiente", "pre_aprobado", "aprobado", "rechazado"];
      const nuevoEstado = String(body.estadoAprobacion);
      if (!estados.includes(nuevoEstado)) {
        return NextResponse.json({ error: `estadoAprobacion inválido: ${estados.join(", ")}` }, { status: 400 });
      }
      setParts.push("estadoAprobacion = ?"); values.push(nuevoEstado);
      setParts.push("estadoAprobacionNota = ?"); values.push(body.estadoAprobacionNota?.trim() || null);
      setParts.push("estadoAprobacionActualizadoEn = ?"); values.push(new Date().toISOString());
      setParts.push("estadoAprobacionActualizadoPor = ?"); values.push(user.id);
      // aprobado = true para aprobado/pre_aprobado
      setParts.push("aprobado = ?"); values.push(nuevoEstado === "aprobado" || nuevoEstado === "pre_aprobado" ? 1 : 0);

      const titulos: Record<string, string> = {
        pendiente: "Cuenta en revisión", pre_aprobado: "Cuenta pre-aprobada",
        aprobado: "Cuenta aprobada", rechazado: "Cuenta rechazada",
      };
      const mensajes: Record<string, string> = {
        pendiente: "Tu cuenta está en espera de aprobación.",
        pre_aprobado: "Tu cuenta fue pre-aprobada.",
        aprobado: "¡Tu cuenta fue aprobada!",
        rechazado: `Tu cuenta fue rechazada. ${body.estadoAprobacionNota ? `Motivo: ${body.estadoAprobacionNota}` : ""}`,
      };
      notifTipo = `cuenta_${nuevoEstado}`;
      notifTitulo = titulos[nuevoEstado] || "Estado actualizado";
      notifMensaje = mensajes[nuevoEstado] || "";
    }

    if (body.plan && ["free", "pro", "enterprise"].includes(body.plan)) {
      setParts.push("plan = ?"); values.push(body.plan);
    }

    // EJECUTAR UPDATE
    if (setParts.length > 0) {
      values.push(id);
      await dbClient.execute({
        sql: `UPDATE AkuoUsuario SET ${setParts.join(", ")} WHERE id = ?`,
        args: values,
      });
    }

    // Crear notificación (opcional — no falla si no se puede)
    if (notifTipo) {
      try {
        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await dbClient.execute({
          sql: "INSERT INTO AkuoNotificacion (id, usuarioId, tipo, titulo, mensaje, link, creadoEn, leida) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
          args: [notifId, id, notifTipo, notifTitulo, notifMensaje, "/akuosplash/transportista", new Date().toISOString()],
        });
      } catch (e) {
        console.error("[PATCH] Notificación no creada:", (e as any)?.message);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH error:", e);
    return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
  }
}
