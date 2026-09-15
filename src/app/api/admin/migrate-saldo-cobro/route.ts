import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET/POST /api/admin/migrate-saldo-cobro
//
// Hace 3 cosas:
// 1. Agrega la columna `esCobroSaldoAnterior` a la tabla Pago (si no existe)
// 2. Hace UPDATE de todos los pagos existentes que parezcan cobro de saldo
//    anterior (por descripción) marcándolos con esCobroSaldoAnterior=1
// 3. Devuelve un reporte con cuántos pagos marcó y cuáles
//
// Esto resuelve el bug donde el usuario veía AMBOS:
//   - El botón "Cobrar saldo anterior" (porque saldoCobrado=false)
//   - El cobro fantasma en la lista de pagos (porque el pago estaba en la DB)
//
// Después de correr esto, /api/liquidacion/periodo detecta los cobros por
// la columna esCobroSaldoAnterior=1 y oculta el botón correctamente.
async function ejecutar() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const results: string[] = [];

  // 1. Verificar si la columna existe, si no, agregarla
  let columnaExiste = false;
  try {
    const cols: Array<{ name: string }> = await db.$queryRawUnsafe(`PRAGMA table_info("Pago");`);
    columnaExiste = cols.some((c) => c.name === "esCobroSaldoAnterior");
    results.push(`Columna esCobroSaldoAnterior existe: ${columnaExiste}`);
  } catch (e) {
    results.push(`Error verificando columna: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!columnaExiste) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Pago" ADD COLUMN "esCobroSaldoAnterior" INTEGER NOT NULL DEFAULT 0;`);
      results.push("Columna esCobroSaldoAnterior agregada a tabla Pago");
      columnaExiste = true;
    } catch (e) {
      results.push(`Error agregando columna: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!columnaExiste) {
    return NextResponse.json({
      ok: false,
      error: "No se pudo agregar la columna esCobroSaldoAnterior",
      results,
    }, { status: 500 });
  }

  // 2. Marcar todos los pagos que parezcan cobro de saldo anterior
  //    por su descripción. Patrones:
  //    - "Cobro de saldo anterior..."
  //    - "Pago de saldo..."
  //    - Cualquier pago con "saldo" + ("anterior" | "liquidación" | "liquidacion")
  //    También marcar pagos sin descripcion pero con clienteId=null y monto
  //    igual a saldoPendienteLiquidacion (cobros viejos mal registrados).
  const config = await db.configuracion.findUnique({
    where: { duenoId },
    select: { saldoPendienteLiquidacion: true },
  });
  const saldoPendiente = config?.saldoPendienteLiquidacion || 0;

  // Buscar pagos candidatos (raw SQL para evitar filtrado de Prisma)
  const pagosCandidatos: Array<{
    id: string;
    monto: number;
    descripcion: string | null;
    fecha: string;
    metodoPago: string;
  }> = await db.$queryRawUnsafe(
    `SELECT "id", "monto", "descripcion", "fecha", "metodoPago" FROM "Pago"
     WHERE "duenoId" = ? AND (
       LOWER(COALESCE("descripcion", '')) LIKE '%cobro de saldo anterior%'
       OR LOWER(COALESCE("descripcion", '')) LIKE '%pago de saldo%'
       OR (LOWER(COALESCE("descripcion", '')) LIKE '%saldo%' AND (
         LOWER(COALESCE("descripcion", '')) LIKE '%anterior%'
         OR LOWER(COALESCE("descripcion", '')) LIKE '%liquidación%'
         OR LOWER(COALESCE("descripcion", '')) LIKE '%liquidacion%'
       ))
       OR ("clienteId" IS NULL AND "monto" = ?)
     );`,
    duenoId,
    saldoPendiente
  );

  let marcados = 0;
  for (const p of pagosCandidatos) {
    try {
      await db.$executeRawUnsafe(
        `UPDATE "Pago" SET "esCobroSaldoAnterior" = 1 WHERE "id" = ?;`,
        p.id
      );
      marcados++;
    } catch (e) {
      results.push(`Error marcando pago ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  results.push(`Pagos marcados como esCobroSaldoAnterior=1: ${marcados} de ${pagosCandidatos.length} candidatos`);

  return NextResponse.json({
    ok: true,
    results,
    saldoPendienteLiquidacion: saldoPendiente,
    pagosMarcados: marcados,
    detallePagosMarcados: pagosCandidatos.map((p) => ({
      id: p.id,
      monto: p.monto,
      descripcion: p.descripcion,
      fecha: String(p.fecha),
      metodoPago: p.metodoPago,
    })),
    message: `Migración OK. ${marcados} pagos marcados como cobro de saldo anterior.`,
  });
}

export async function GET() { return ejecutar(); }
export async function POST() { return ejecutar(); }
