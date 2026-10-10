import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// Endpoint TEMPORAL para migrar columnas de precio dinámico en AkuoSplash (Turso/libSQL).
// Ejecutar una sola vez desde el browser logueado como superadmin.
//
// Migraciones:
// - AkuoConfig: precioDinamicoHabilitado (Boolean), reglasPrecioJson (TEXT), depotLat (REAL), depotLng (REAL), depotNombre (TEXT)
// - AkuoZona: precioMinimoPorLitro (REAL), precioMinimoTotal (REAL), precioMaximoPorLitro (REAL)
// - AkuoPedidoCliente: precioSnapshotJson (TEXT), precioDinamicoHabilitado (Boolean), precioPorLitroFinal (REAL)
//
// Uso: POST /api/akuosplash/admin/migrate-precio-dinamico (requiere superadmin)
// Idempotente: si la columna ya existe, SQLite devuelve "duplicate column name" y lo reportamos como "ya existía".
export async function POST(_req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (user.rol !== "superadmin") {
    return NextResponse.json({ error: "Solo superadmin puede migrar" }, { status: 403 });
  }

  const results: { column: string; status: string; error?: string }[] = [];

  // Lista de columnas a verificar/agregar
  // formato: [tabla, columna, definicionSQL]
  const migraciones: [string, string, string][] = [
    // AkuoConfig
    ["AkuoConfig", "precioDinamicoHabilitado", "BOOLEAN NOT NULL DEFAULT 0"],
    ["AkuoConfig", "reglasPrecioJson", "TEXT"],
    ["AkuoConfig", "depotLat", "REAL"],
    ["AkuoConfig", "depotLng", "REAL"],
    ["AkuoConfig", "depotNombre", "TEXT"],
    // AkuoZona
    ["AkuoZona", "precioMinimoPorLitro", "REAL"],
    ["AkuoZona", "precioMinimoTotal", "REAL"],
    ["AkuoZona", "precioMaximoPorLitro", "REAL"],
    // AkuoPedidoCliente
    ["AkuoPedidoCliente", "precioSnapshotJson", "TEXT"],
    ["AkuoPedidoCliente", "precioDinamicoHabilitado", "BOOLEAN NOT NULL DEFAULT 0"],
    ["AkuoPedidoCliente", "precioPorLitroFinal", "REAL"],
  ];

  for (const [tabla, columna, definicion] of migraciones) {
    try {
      await akuosplashDb.$executeRawUnsafe(`ALTER TABLE "${tabla}" ADD COLUMN "${columna}" ${definicion};`);
      results.push({ column: `${tabla}.${columna}`, status: "agregada" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate column name") || msg.includes("already exists")) {
        results.push({ column: `${tabla}.${columna}`, status: "ya existía" });
      } else {
        results.push({ column: `${tabla}.${columna}`, status: "error", error: msg });
      }
    }
  }

  // Backfill: crear la fila de AkuoConfig si no existe (suele pasar si la tabla estaba vacía)
  try {
    const existingConfig = await akuosplashDb.akuoConfig.findFirst();
    if (!existingConfig) {
      await akuosplashDb.akuoConfig.create({
        data: {
          comisionPorcentaje: 0,
          precioPlanPro: 15000,
          precioPlanEnterprise: 50000,
          maxVehiculosFree: 1,
          maxVehiculosPro: 5,
          maxVehiculosEnterprise: 999,
          activo: true,
          precioDinamicoHabilitado: false,
        },
      });
      results.push({ column: "AkuoConfig (fila)", status: "creada (estaba vacía)" });
    } else {
      results.push({ column: "AkuoConfig (fila)", status: "ya existía" });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ column: "AkuoConfig (fila)", status: "error", error: msg });
  }

  return NextResponse.json({ ok: true, results });
}
