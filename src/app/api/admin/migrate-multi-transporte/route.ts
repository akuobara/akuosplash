import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, getDuenoId } from "@/lib/auth";

// GET /api/admin/migrate-multi-transporte
// Agrega los campos necesarios para multi-tipo de transporte:
// - Configuracion.tipoTransporte (string, default "aljibe")
// - Entrega.tipoTransporte (string, default "aljibe")
// - Entrega.origen (string, nullable) — dirección de origen
// - Entrega.destino (string, nullable) — dirección de destino
// - Entrega.tipoCarga (string, nullable) — tipo de carga (ej: "mudanza completa", "arena", "flete general")
// - Entrega.toneladas (float, nullable) — para áridos
// - Entrega.horasTrabajadas (float, nullable) — para mudanza
// - Entrega.cantidadPersonal (int, nullable) — para mudanza
// - Entrega.material (string, nullable) — para áridos (arena, ripio, tierra, etc.)
// - Entrega.duracionMinutos (int, nullable) — duración del trabajo en minutos
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const duenoId = await getDuenoId();
  if (!duenoId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const results: string[] = [];

  // 1. Agregar tipoTransporte a Configuracion (si no existe)
  try {
    await db.$executeRawUnsafe(`ALTER TABLE "Configuracion" ADD COLUMN "tipoTransporte" TEXT NOT NULL DEFAULT 'aljibe';`);
    results.push("✓ Agregado Configuracion.tipoTransporte (default 'aljibe')");
  } catch (e: any) {
    if (e.message?.includes("duplicate column")) results.push("✓ Configuracion.tipoTransporte ya existe");
    else results.push("⚠ Configuracion.tipoTransporte: " + e.message);
  }

  // 2. Agregar campos a Entrega
  const campos = [
    { nombre: "tipoTransporte", tipo: "TEXT", default: "'aljibe'" },
    { nombre: "origen", tipo: "TEXT", default: "NULL" },
    { nombre: "destino", tipo: "TEXT", default: "NULL" },
    { nombre: "tipoCarga", tipo: "TEXT", default: "NULL" },
    { nombre: "toneladas", tipo: "REAL", default: "NULL" },
    { nombre: "horasTrabajadas", tipo: "REAL", default: "NULL" },
    { nombre: "cantidadPersonal", tipo: "INTEGER", default: "NULL" },
    { nombre: "material", tipo: "TEXT", default: "NULL" },
    { nombre: "duracionMinutos", tipo: "INTEGER", default: "NULL" },
  ];

  for (const campo of campos) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "Entrega" ADD COLUMN "${campo.nombre}" ${campo.tipo} DEFAULT ${campo.default};`);
      results.push(`✓ Agregado Entrega.${campo.nombre}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column")) results.push(`✓ Entrega.${campo.nombre} ya existe`);
      else results.push(`⚠ Entrega.${campo.nombre}: ${e.message}`);
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    message: "Migración multi-transporte completada. Campos agregados a Entrega y Configuracion.",
  });
}
