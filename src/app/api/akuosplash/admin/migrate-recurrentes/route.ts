import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";

// POST /api/akuosplash/admin/migrate-recurrentes
// Crea la tabla AkuoPedidoRecurrente si no existe
export async function POST() {
  try {
    await akuosplashDb.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AkuoPedidoRecurrente" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "transportistaId" TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "litrosSolicitados" REAL NOT NULL,
        "metodoPagoPreferido" TEXT NOT NULL DEFAULT 'credito',
        "nota" TEXT,
        "frecuenciaDias" INTEGER NOT NULL,
        "fechaInicio" DATETIME NOT NULL,
        "fechaProximaGeneracion" DATETIME NOT NULL,
        "activo" BOOLEAN NOT NULL DEFAULT 1,
        "diaSemanaPreferido" INTEGER,
        "asignacionTipo" TEXT NOT NULL DEFAULT 'manual',
        "choferAsignadoId" TEXT,
        FOREIGN KEY ("transportistaId") REFERENCES "AkuoUsuario"("id") ON DELETE CASCADE,
        FOREIGN KEY ("clienteId") REFERENCES "AkuoCliente"("id") ON DELETE CASCADE
      );
    `);
    await akuosplashDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_AkuoPedidoRecurrente_transportistaId_activo" ON "AkuoPedidoRecurrente"("transportistaId", "activo");`);
    await akuosplashDb.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_AkuoPedidoRecurrente_clienteId" ON "AkuoPedidoRecurrente"("clienteId");`);
    return NextResponse.json({ ok: true, message: "Tabla AkuoPedidoRecurrente creada" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error" }, { status: 500 });
  }
}

export async function GET() { return POST(); }
