import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/admin/migrate-plan-configs
// Agrega los campos nuevos:
//   - AkuoConfig: planConfigsJson + mpInstant* + mp10day*
//   - AkuoUsuario: mpSub* (campos de subscripción MP)
//   - AkuoPedidoCliente: docTributario* (documentos subidos por transportistas Plan Gratis)
// Idempotente: si las columnas ya existen, reporta "ya existía"
export async function POST() {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const results: string[] = [];

  const statements = [
    // AkuoConfig: planConfigsJson + MP instant + MP 10day
    "ALTER TABLE AkuoConfig ADD COLUMN planConfigsJson TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpInstantAccessToken TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpInstantPublicKey TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mpInstantUserId TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mp10dayAccessToken TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mp10dayPublicKey TEXT",
    "ALTER TABLE AkuoConfig ADD COLUMN mp10dayUserId TEXT",
    // AkuoUsuario: campos MP preapproval (subscription)
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubPreapprovalId TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubPlanSolicitado TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubCiclo TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubStatus TEXT",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubIniciadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubAutorizadoEn DATETIME",
    "ALTER TABLE AkuoUsuario ADD COLUMN mpSubAmount REAL",
    // AkuoPedidoCliente: documentos tributarios subidos por transportistas Plan Gratis
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioUrl TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioFolio TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioSubidoEn DATETIME",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioSubidoPor TEXT",
    "ALTER TABLE AkuoPedidoCliente ADD COLUMN docTributarioMonto REAL",
  ];

  for (const sql of statements) {
    try {
      await akuosplashDb.$executeRawUnsafe(sql);
      results.push(`OK: ${sql.substring(0, 100)}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column") || e.message?.includes("already exists")) {
        results.push(`ya existía: ${sql.substring(0, 100)}`);
      } else {
        results.push(`ERROR: ${sql.substring(0, 100)} → ${e.message}`);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    note: "Después de correr esto, configurá las 2 cuentas MP en superadmin → Integraciones",
  });
}
