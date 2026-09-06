import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Endpoint TEMPORAL para crear la tabla AuditLog en producción.
// Ejecutar una sola vez y luego borrar este archivo.
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const results: { step: string; status: string; error?: string }[] = [];

  // Crear tabla AuditLog con todos sus campos e índices
  const sql = `
    CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "actorId" TEXT,
      "actorNombre" TEXT NOT NULL,
      "actorRole" TEXT NOT NULL,
      "actorEmail" TEXT,
      "accion" TEXT NOT NULL,
      "entidad" TEXT NOT NULL,
      "entidadId" TEXT,
      "entidadNombre" TEXT,
      "duenoId" TEXT,
      "descripcion" TEXT NOT NULL,
      "detalleJson" TEXT,
      "ip" TEXT,
      "userAgent" TEXT
    );
  `;

  try {
    await db.$executeRawUnsafe(sql);
    results.push({ step: "CREATE TABLE AuditLog", status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      results.push({ step: "CREATE TABLE AuditLog", status: "ya existía" });
    } else {
      results.push({ step: "CREATE TABLE AuditLog", status: "error", error: msg });
    }
  }

  // Crear índices
  const indices = [
    `CREATE INDEX IF NOT EXISTS "AuditLog_creadoEn_idx" ON "AuditLog"("creadoEn");`,
    `CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");`,
    `CREATE INDEX IF NOT EXISTS "AuditLog_entidad_accion_idx" ON "AuditLog"("entidad", "accion");`,
    `CREATE INDEX IF NOT EXISTS "AuditLog_duenoId_idx" ON "AuditLog"("duenoId");`,
  ];

  for (const idxSql of indices) {
    try {
      await db.$executeRawUnsafe(idxSql);
      results.push({ step: `INDEX: ${idxSql.match(/"(\w+)"/)?.[1] || "?"}`, status: "ok" });
    } catch (e) {
      results.push({
        step: `INDEX: ${idxSql.match(/"(\w+)"/)?.[1] || "?"}`,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
