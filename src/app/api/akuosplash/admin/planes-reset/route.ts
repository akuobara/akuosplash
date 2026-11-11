import { NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { DEFAULT_PLAN_CONFIGS, savePlanConfigs, getPlanConfigs } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/admin/planes-reset
// Borra los valores mal guardados en AkuoPlanConfig y los restaura a DEFAULT_PLAN_CONFIGS.
// Esto arregla los planes que quedaron con comisiones incorrectas (0%, 0.5%, etc.)
// por ediciones anteriores que se guardaron mal.
export async function POST() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    // Primero: borrar TODOS los rows existentes para que no quede nada raro
    const { createClient } = await import("@libsql/client");
    const client = createClient({
      url: process.env.AKUOSPLASH_DATABASE_URL || process.env.DATABASE_URL || "",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    try {
      await client.execute("DELETE FROM AkuoPlanConfig");
    } catch (e: any) {
      console.warn("[planes-reset] DELETE failed (tabla quizás no existe):", e?.message);
    }

    // Segundo: guardar los defaults (esto hace UPSERT y recrea los rows)
    const defaults = {
      gratis: DEFAULT_PLAN_CONFIGS.gratis,
      premium: DEFAULT_PLAN_CONFIGS.premium,
      pro: DEFAULT_PLAN_CONFIGS.pro,
    };
    await savePlanConfigs(defaults);

    // Verificar
    const verify = await getPlanConfigs();
    const resumen = Object.values(verify).map((p: any) => ({
      id: p.id,
      nombre: p.nombre,
      comisionPct: p.comisionPct,
      precioMensual: p.precioMensual,
      precioAnual: p.precioAnual,
      mpSplitMode: p.mpSplitMode,
      activa: p.activa,
    }));

    return NextResponse.json({
      ok: true,
      mensaje: "Planes restaurados a defaults (gratis=15%, premium=12.5%, pro=8.5%, SIN MP split)",
      planes: resumen,
    });
  } catch (e: any) {
    console.error("[planes-reset] error:", e);
    return NextResponse.json({ error: e?.message || "Error desconocido" }, { status: 500 });
  }
}
