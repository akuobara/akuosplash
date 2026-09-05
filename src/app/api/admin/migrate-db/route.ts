import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// Endpoint TEMPORAL para migrar columnas faltantes en producción (Turso/libSQL).
// Ejecutar una sola vez y luego borrar este archivo.
//
// Migraciones pendientes:
// - Configuracion.ultimoCierre (DateTime?)
// - Cualquier otra columna nueva que falte
//
// Uso: POST /api/admin/migrate-db (requiere sesión de admin)
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (session.role !== "dueno" && session.role !== "super_admin") {
    return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  }

  const results: { column: string; status: string; error?: string }[] = [];

  // Lista de columnas a verificar/agregar
  // formato: [tabla, columna, definicionSQL]
  const migraciones: [string, string, string][] = [
    ["Configuracion", "ultimoCierre", "DateTime"],
  ];

  for (const [tabla, columna, definicion] of migraciones) {
    try {
      // Prisma no permite ALTER TABLE directamente, pero podemos usar $executeRawUnsafe
      // SQLite agrega la columna como NULL por defecto, que es lo que queremos.
      await db.$executeRawUnsafe(`ALTER TABLE "${tabla}" ADD COLUMN "${columna}" ${definicion};`);
      results.push({ column: `${tabla}.${columna}`, status: "agregada" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Si la columna ya existe, SQLite devuelve "duplicate column name"
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        results.push({ column: `${tabla}.${columna}`, status: "ya existía" });
      } else {
        results.push({ column: `${tabla}.${columna}`, status: "error", error: msg });
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
