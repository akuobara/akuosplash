import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoNotificar } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// GET/POST /api/akuosplash/cron/expirar-planes
// Se ejecuta diariamente (via cron externo o Vercel cron) para:
//   1. Detectar planes vencidos (planActivoHasta < ahora)
//   2. Bajar a plan Gratis a esos transportistas
//   3. Si tenían subscripción activa, ahora deben renewar
//   4. Notificar al transportista que su plan venció
//
// Auth: requiere header CRON_SECRET o token vercel cron (defensivo)
export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  // Verificar auth del cron (defensivo — si no está configurado, permite igual)
  const cronSecret = process.env.AKUO_CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || "";
    const providedSecret = authHeader.replace("Bearer ", "");
    if (providedSecret !== cronSecret) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  }

  await ensureAkuoConfigColumns();
  const ahora = new Date();

  // Buscar todos los usuarios con plan != "gratis" cuyo planActivoHasta ya pasó
  const vencidosResult: any = await akuosplashDb.$queryRawUnsafe(
    `SELECT id, email, nombre, plan, planActivoHasta, mpSubStatus, mpSubPreapprovalId
     FROM AkuoUsuario
     WHERE plan != 'gratis' AND plan IS NOT NULL
       AND planActivoHasta IS NOT NULL
       AND planActivoHasta < ?
       AND (planExpiradoNotificado IS NULL OR planExpiradoNotificado = 0)`,
    ahora.toISOString()
  ).catch(async (e: any): Promise<any> => {
    // Si la columna planExpiradoNotificado no existe, agregarla y reintentar
    if (String(e?.message || "").includes("no such column")) {
      await akuosplashDb.$executeRawUnsafe(
        `ALTER TABLE AkuoUsuario ADD COLUMN planExpiradoNotificado INTEGER DEFAULT 0`
      ).catch(() => {});
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT id, email, nombre, plan, planActivoHasta, mpSubStatus, mpSubPreapprovalId
         FROM AkuoUsuario
         WHERE plan != 'gratis' AND plan IS NOT NULL
           AND planActivoHasta IS NOT NULL
           AND planActivoHasta < ?`,
        ahora.toISOString()
      ).catch(() => []);
      return r;
    }
    return [];
  });
  const vencidos: any[] = Array.isArray(vencidosResult) ? vencidosResult : [];

  if (!Array.isArray(vencidos) || vencidos.length === 0) {
    return NextResponse.json({ ok: true, vencidos: 0, message: "No hay planes vencidos" });
  }

  let procesados = 0;
  let notificados = 0;

  for (const u of vencidos) {
    try {
      // Bajar a plan gratis (sin tocar planActivoDesde/Hasta — se mantiene el histórico)
      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoUsuario SET plan = 'gratis', suscripcionActiva = 0 WHERE id = ?`,
        u.id
      ).catch(() => {});

      // Si la columna planExpiradoNotificado existe, marcarla
      await akuosplashDb.$executeRawUnsafe(
        `UPDATE AkuoUsuario SET planExpiradoNotificado = 1 WHERE id = ?`,
        u.id
      ).catch(() => {});

      // Notificar al transportista
      await akuoNotificar(
        u.id,
        "plan_vencido",
        "⏰ Tu plan venció",
        `Tu plan ${u.plan} venció el ${u.planActivoHasta ? new Date(u.planActivoHasta).toLocaleDateString("es-CL") : "?"}. Ahora estás en plan Gratis. Para volver a tu plan, volvé a subscribirte.`,
        "/akuosplash/transportista?tab=subscripcion"
      );
      notificados++;
      procesados++;
    } catch (e: any) {
      console.error(`[expirar-planes] error procesando ${u.id}:`, e?.message);
    }
  }

  return NextResponse.json({
    ok: true,
    vencidos: vencidos.length,
    procesados,
    notificados,
    ahora: ahora.toISOString(),
  });
}
