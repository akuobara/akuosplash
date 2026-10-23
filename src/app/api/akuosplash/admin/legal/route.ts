import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// PUT /api/akuosplash/admin/legal
// Actualiza el contenido de las páginas legales (superadmin only).
// Body: { terminos?, privacidad?, empresa? }
export async function PUT(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoConfig ADD COLUMN legalPagesJson TEXT`).catch(() => {});

  // Leer contenido actual
  let current: any = {};
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT legalPagesJson FROM AkuoConfig WHERE activo = 1 LIMIT 1`
    );
    if (Array.isArray(r) && r.length > 0 && r[0]?.legalPagesJson) {
      current = JSON.parse(r[0].legalPagesJson);
    }
  } catch {}

  const body = await req.json();
  const ahora = new Date().toISOString();

  // Merge con defaults
  const nuevo = {
    terminos: body.terminos
      ? { ...current.terminos, ...body.terminos, lastUpdated: ahora }
      : current.terminos || { version: "1.0", lastUpdated: ahora, content: "" },
    privacidad: body.privacidad
      ? { ...current.privacidad, ...body.privacidad, lastUpdated: ahora }
      : current.privacidad || { version: "1.0", lastUpdated: ahora, content: "" },
    empresa: body.empresa ? { ...current.empresa, ...body.empresa } : current.empresa || {},
  };

  // Guardar
  const json = JSON.stringify(nuevo);
  const existing: any = await akuosplashDb.$queryRawUnsafe(
    `SELECT id FROM AkuoConfig WHERE activo = 1 LIMIT 1`
  ).catch(() => []);

  if (Array.isArray(existing) && existing.length > 0) {
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoConfig SET legalPagesJson = ? WHERE id = ?`,
      json, existing[0].id
    );
  } else {
    await akuosplashDb.$executeRawUnsafe(
      `INSERT INTO AkuoConfig (id, creadoEn, comisionPorcentaje, activo, legalPagesJson) VALUES (?, ?, 0, 1, ?)`,
      `cfg_${Date.now()}`, ahora, json
    );
  }

  return NextResponse.json({ ok: true });
}
