import { NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/admin/diag-planes — No requiere auth
export async function POST() {
  await ensureAkuoConfigColumns();
  const steps: any[] = [];

  // 1. Columnas
  const cols: any = await akuosplashDb.$queryRawUnsafe(`PRAGMA table_info(AkuoConfig)`).catch(() => []);
  const colNames = Array.isArray(cols) ? cols.map((c:any)=>c.name) : [];
  steps.push({ hasPlanConfigsJson: colNames.includes("planConfigsJson") });

  // 2. Leer actual
  let rowId: string | null = null;
  const r: any = await akuosplashDb.$queryRawUnsafe(`SELECT id, planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1`).catch(() => []);
  if (Array.isArray(r) && r.length > 0) {
    rowId = r[0].id;
    steps.push({ currentRow: rowId, hasJson: !!r[0].planConfigsJson });
  } else {
    steps.push({ noRow: true });
  }

  // 3. Guardar test
  const testJson = JSON.stringify({ test: true, ts: Date.now() });
  let saved = false;
  if (rowId) {
    try {
      const res = await akuosplashDb.$executeRawUnsafe(`UPDATE AkuoConfig SET planConfigsJson = ? WHERE id = ?`, testJson, rowId);
      steps.push({ update: res, ok: res > 0 });
      saved = res > 0;
    } catch (e:any) {
      steps.push({ updateError: e?.message });
    }
  } else {
    try {
      const newId = `cfg_${Date.now()}`;
      await akuosplashDb.$executeRawUnsafe(`INSERT INTO AkuoConfig (id, creadoEn, comisionPorcentaje, activo, planConfigsJson) VALUES (?, ?, 0, 1, ?)`, newId, new Date().toISOString(), testJson);
      steps.push({ insert: newId, ok: true });
      saved = true;
    } catch (e:any) {
      steps.push({ insertError: e?.message });
    }
  }

  // 4. Releer
  const r2: any = await akuosplashDb.$queryRawUnsafe(`SELECT planConfigsJson FROM AkuoConfig WHERE activo = 1 LIMIT 1`).catch(() => []);
  if (Array.isArray(r2) && r2.length > 0) {
    const readBack = r2[0].planConfigsJson;
    steps.push({ readBack: readBack?.substring(0, 50), matches: readBack === testJson });
  } else {
    steps.push({ readBack: null, noRow: true });
  }

  return NextResponse.json({ steps, saved });
}
