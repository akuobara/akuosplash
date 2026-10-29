import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser, akuoAuditar } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  await ensureAkuoConfigColumns();
  const { id } = await params;

  // Get target user via raw SQL
  const targetRows: any = await akuosplashDb.$queryRawUnsafe(
    `SELECT id, email FROM AkuoUsuario WHERE id = ? LIMIT 1`, id
  ).catch(() => []);
  if (!Array.isArray(targetRows) || targetRows.length === 0) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }
  const target = targetRows[0];
  if (target.id === user.id) {
    return NextResponse.json({ error: "No podés modificar tu propia cuenta" }, { status: 400 });
  }

  try {
    const body = await req.json();

    // estadoAprobacion (pendiente | pre_aprobado | aprobado | rechazado)
    if (body.estadoAprobacion !== undefined) {
      const estadosValidos = ["pendiente", "pre_aprobado", "aprobado", "rechazado"];
      const nuevoEstado = String(body.estadoAprobacion);
      if (!estadosValidos.includes(nuevoEstado)) {
        return NextResponse.json({ error: `estadoAprobacion inválido. Valores: ${estadosValidos.join(", ")}` }, { status: 400 });
      }
      const nota = body.estadoAprobacionNota?.trim() || null;
      const ahora = new Date().toISOString();
      // Raw SQL UPDATE (Prisma update no funciona en Render)
      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoUsuario SET estadoAprobacion = ?, estadoAprobacionNota = ?, estadoAprobacionActualizadoEn = ?, estadoAprobacionActualizadoPor = ? WHERE id = ?`,
        nuevoEstado, nota, ahora, user.id, id
      );
      // Also set aprobado boolean for compat
      const aprobado = (nuevoEstado === "aprobado" || nuevoEstado === "pre_aprobado");
      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoUsuario SET aprobado = ? WHERE id = ?`,
        aprobado ? 1 : 0, id
      ).catch(() => {});
      await akuoAuditar(user.id, `cambiar_estado_aprobacion_${nuevoEstado}`, "AkuoUsuario", id, `Usuario ${target.email} estadoAprobacion=${nuevoEstado}`);
      // Notificación
      try {
        const titulos: Record<string, string> = {
          pendiente: "Cuenta en revisión", pre_aprobado: "Cuenta pre-aprobada",
          aprobado: "Cuenta aprobada", rechazado: "Cuenta rechazada",
        };
        const mensajes: Record<string, string> = {
          pendiente: "Tu registro está completo. Tu cuenta está en espera de aprobación.",
          pre_aprobado: "Tu cuenta fue pre-aprobada. Vas a poder acceder al marketplace cuando esté disponible en tu zona.",
          aprobado: "¡Tu cuenta fue aprobada! Ya podés operar en el marketplace cuando esté disponible en tu zona.",
          rechazado: `Tu cuenta fue rechazada. ${nota ? `Motivo: ${nota}` : "Contactá soporte."}`,
        };
        await akuosplashDb.$executeRawUnsafe(
          `INSERT INTO AkuoNotificacion (id, creadoEn, usuarioId, tipo, titulo, mensaje, link) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          `notif_${Date.now()}_${id.substring(0,8)}`, ahora, id,
          `cuenta_${nuevoEstado}`, titulos[nuevoEstado] || "Estado actualizado",
          mensajes[nuevoEstado] || "Tu estado fue actualizado.", "/akuosplash/transportista"
        );
      } catch {}
      return NextResponse.json({ ok: true, estadoAprobacion: nuevoEstado });
    }

    // aprobado (legacy boolean)
    if (body.aprobado !== undefined) {
      const val = body.aprobado ? 1 : 0;
      await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET aprobado = ? WHERE id = ?`, val, id);
      return NextResponse.json({ ok: true, aprobado: body.aprobado });
    }

    // banned
    if (body.banned !== undefined) {
      const val = body.banned ? 1 : 0;
      const razon = body.banRazon?.trim() || null;
      await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET banned = ?, banRazon = ? WHERE id = ?`, val, razon, id);
      return NextResponse.json({ ok: true, banned: body.banned });
    }

    // activo
    if (body.activo !== undefined) {
      const val = body.activo ? 1 : 0;
      await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET activo = ? WHERE id = ?`, val, id);
      return NextResponse.json({ ok: true, activo: body.activo });
    }

    // rol
    if (body.rol && ["cliente", "transportista", "superadmin"].includes(body.rol)) {
      await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET rol = ? WHERE id = ?`, body.rol, id);
      return NextResponse.json({ ok: true, rol: body.rol });
    }

    // vehiculosPermitidos
    if (body.vehiculosPermitidos !== undefined) {
      await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET vehiculosPermitidos = ? WHERE id = ?`, Number(body.vehiculosPermitidos), id);
      return NextResponse.json({ ok: true });
    }

    // plan
    if (body.plan && ["free", "pro", "enterprise"].includes(body.plan)) {
      await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoUsuario SET plan = ? WHERE id = ?`, body.plan, id);
      return NextResponse.json({ ok: true, plan: body.plan });
    }

    return NextResponse.json({ ok: true, note: "Sin cambios" });
  } catch (e: any) {
    console.error("[superadmin/usuarios/[id] PATCH] error:", e);
    return NextResponse.json({ error: "No se pudo actualizar: " + (e?.message || "") }, { status: 500 });
  }
}
