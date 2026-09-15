import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/admin/migrate-cupones
// Crea la tabla CuponDescuento y agrega columnas de cupón / MP en PedidoApp.
// Idempotente: se puede ejecutar varias veces sin romper nada.
export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  // Cualquier usuario autenticado puede ejecutar la migración (es solo CREATE TABLE / ALTER)

  const results: { step: string; status: string; error?: string }[] = [];

  // 1) Crear tabla CuponDescuento
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS "CuponDescuento" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "codigo" TEXT NOT NULL,
      "descripcion" TEXT,
      "tipo" TEXT NOT NULL DEFAULT 'porcentaje',
      "valor" REAL NOT NULL,
      "montoMinimo" REAL,
      "usosMaximos" INTEGER,
      "usosActuales" INTEGER NOT NULL DEFAULT 0,
      "activo" BOOLEAN NOT NULL DEFAULT 1,
      "validoDesde" DATETIME,
      "validoHasta" DATETIME,
      "creadoPorId" TEXT,
      "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "zonaId" TEXT
    );
  `;
  try {
    await db.$executeRawUnsafe(createTableSql);
    results.push({ step: "CREATE TABLE CuponDescuento", status: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      results.push({ step: "CREATE TABLE CuponDescuento", status: "ya existía" });
    } else {
      results.push({ step: "CREATE TABLE CuponDescuento", status: "error", error: msg });
    }
  }

  // 2) Índice único en codigo
  try {
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "CuponDescuento_codigo_key" ON "CuponDescuento"("codigo");`);
    results.push({ step: "UNIQUE INDEX codigo", status: "ok" });
  } catch (e) {
    results.push({
      step: "UNIQUE INDEX codigo",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 3) Índice normal en codigo (para búsquedas rápidas)
  try {
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CuponDescuento_codigo_idx" ON "CuponDescuento"("codigo");`);
    results.push({ step: "INDEX codigo", status: "ok" });
  } catch (e) {
    results.push({
      step: "INDEX codigo",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 4) Agregar columnas de cupón a PedidoApp (si no existen)
  const alterPedidoApp = [
    { col: "cuponCodigo", type: "TEXT" },
    { col: "descuento", type: "REAL" },
    { col: "montoOriginal", type: "REAL" },
    { col: "mpPreferenceId", type: "TEXT" },
    { col: "mpPaymentId", type: "TEXT" },
  ];

  for (const { col, type } of alterPedidoApp) {
    try {
      // SQLite no soporta "IF NOT EXISTS" en ALTER TABLE, así que verificamos primero.
      const cols: Array<{ name: string }> = await db.$queryRawUnsafe(
        `PRAGMA table_info("PedidoApp");`
      );
      const existe = cols.some((c) => c.name === col);
      if (existe) {
        results.push({ step: `ALTER PedidoApp ADD ${col}`, status: "ya existía" });
      } else {
        await db.$executeRawUnsafe(`ALTER TABLE "PedidoApp" ADD COLUMN "${col}" ${type};`);
        results.push({ step: `ALTER PedidoApp ADD ${col}`, status: "ok" });
      }
    } catch (e) {
      results.push({
        step: `ALTER PedidoApp ADD ${col}`,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}

// GET handler para poder ejecutar desde el navegador
export async function GET(req: NextRequest) {
  return POST(req);
}
