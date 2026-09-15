import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/migrate-saldo-cobro
// Agrega la columna `esCobroSaldoAnterior` a la tabla Pago y hace backfill de
// los pagos existentes que ya son cobros de saldo (los marca con flag=true).
//
// Esto elimina la dependencia del texto de la descripcion para detectar cobros
// de saldo anterior. El filtro en /api/liquidacion/periodo ahora usa
// `p.esCobroSaldoAnterior === true` como check primario, con fallback al texto.
//
// Idempotente: se puede ejecutar varias veces sin romper nada.
export async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const results: { step: string; status: string; error?: string; data?: unknown }[] = [];

  // 1) Verificar si la columna existe. Si no existe, agregarla.
  try {
    const cols: Array<{ name: string }> = await db.$queryRawUnsafe(`PRAGMA table_info("Pago");`);
    const existe = cols.some((c) => c.name === "esCobroSaldoAnterior");
    if (existe) {
      results.push({ step: "ALTER Pago ADD esCobroSaldoAnterior", status: "ya existía" });
    } else {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Pago" ADD COLUMN "esCobroSaldoAnterior" BOOLEAN NOT NULL DEFAULT 0;`
      );
      results.push({ step: "ALTER Pago ADD esCobroSaldoAnterior", status: "ok" });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column name") || msg.includes("already exists")) {
      results.push({ step: "ALTER Pago ADD esCobroSaldoAnterior", status: "ya existía" });
    } else {
      results.push({
        step: "ALTER Pago ADD esCobroSaldoAnterior",
        status: "error",
        error: msg,
      });
    }
  }

  // 2) Backfill: marcar como esCobroSaldoAnterior=1 los pagos existentes cuya
  //    descripcion coincide con los patrones conocidos.
  //    SQLite LIKE es case-insensitive por defecto para ASCII, así que un solo
  //    patrón en minúsculas cubre todos los casings.
  try {
    // Patron: "cobro de saldo anterior"
    const r1 = await db.$executeRawUnsafe(
      `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1 WHERE "esCobroSaldoAnterior" = 0 AND LOWER("descripcion") LIKE '%cobro de saldo anterior%';`
    );
    results.push({ step: "UPDATE patron 'cobro de saldo anterior'", status: "ok", data: { affected: r1 } });

    // Patron: "pago de saldo"
    const r2 = await db.$executeRawUnsafe(
      `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1 WHERE "esCobroSaldoAnterior" = 0 AND LOWER("descripcion") LIKE '%pago de saldo%';`
    );
    results.push({ step: "UPDATE patron 'pago de saldo'", status: "ok", data: { affected: r2 } });

    // Patron: saldo + (anterior | liquidación | liquidacion)
    const r3 = await db.$executeRawUnsafe(
      `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1
       WHERE "esCobroSaldoAnterior" = 0
         AND LOWER("descripcion") LIKE '%saldo%'
         AND (LOWER("descripcion") LIKE '%anterior%'
              OR LOWER("descripcion") LIKE '%liquidación%'
              OR LOWER("descripcion") LIKE '%liquidacion%');`
    );
    results.push({ step: "UPDATE patron 'saldo' + 'anterior/liquidación'", status: "ok", data: { affected: r3 } });

    // Patron extra defensivo: cualquier pago sin clienteId con monto = saldoPendienteLiquidacion
    // (caso raro: descripcion null pero monto coincide con el saldo arrastrado)
    const config = await db.configuracion.findUnique({
      where: { duenoId },
      select: { saldoPendienteLiquidacion: true },
    });
    const saldoPend = config?.saldoPendienteLiquidacion || 0;
    if (saldoPend > 0) {
      const r4 = await db.$executeRawUnsafe(
        `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1
         WHERE "esCobroSaldoAnterior" = 0
           AND "clienteId" IS NULL
           AND "monto" = ${saldoPend};`
      );
      results.push({
        step: `UPDATE patron monto=${saldoPend} sin cliente`,
        status: "ok",
        data: { affected: r4 },
      });
    }
  } catch (e) {
    results.push({
      step: "UPDATE backfill",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // 3) Reportar cuántos pagos quedaron marcados en total
  try {
    const total: Array<{ cnt: bigint }> = await db.$queryRawUnsafe(
      `SELECT COUNT(*) AS cnt FROM "Pago" WHERE "esCobroSaldoAnterior" = 1;`
    );
    results.push({
      step: "REPORTE total pagos marcados",
      status: "ok",
      data: { total_marcados: Number(total[0]?.cnt ?? 0) },
    });
  } catch (e) {
    results.push({
      step: "REPORTE total pagos marcados",
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  return NextResponse.json({
    ok: true,
    message:
      "Migración completada. La columna esCobroSaldoAnterior fue agregada y los pagos existentes fueron marcados.",
    results,
  });
}

export async function POST(_req: NextRequest) {
  return ejecutar();
}
export async function GET(_req: NextRequest) {
  return ejecutar();
}
