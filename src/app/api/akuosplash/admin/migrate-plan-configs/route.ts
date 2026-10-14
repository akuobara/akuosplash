import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/admin/migrate-plan-configs
// Agrega los campos nuevos a AkuoConfig y AkuoUsuario (planConfigsJson + mpSub* campos)
// Idempotente: si las columnas ya existen, reporta "ya existía"
export async function POST() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const results: string[] = [];

  // AkuoConfig: 1 campo nuevo (planConfigsJson)
  // AkuoUsuario: 8 campos nuevos (mpSub*)
  const statements = [
    "ALTER TABLE AkuoConfig ADD COLUMN planConfigsJson TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubPreapprovalId TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubPlanSolicitado TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubCiclo TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubStatus TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubIniciadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubAutorizadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubAmount REAL",
  ];

  for (const sql of statements) {
    try {
      await akuosplashDb.$executeRawUnsafe(sql);
      results.push(`OK: ${sql.substring(0, 80)}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column") || e.message?.includes("already exists")) {
        results.push(`ya existía: ${sql.substring(0, 80)}`);
      } else {
        results.push(`ERROR: ${sql.substring(0, 80)} → ${e.message}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    note: "Después de correr esto, los planes pueden configurarse desde superadmin → Planes",
  });
}
