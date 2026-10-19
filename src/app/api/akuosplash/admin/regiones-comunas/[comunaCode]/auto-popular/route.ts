import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
import localidadesData from "@/data/chile-localidades.json";

// POST /api/akuosplash/admin/regiones-comunas/[comunaCode]/auto-popular
// Auto-crea sub-zonas para todas las localidades pre-definidas de una comuna.
// Usa los datos de GeoNames (chile-localidades.json).
// Body: { soloTipo?: "urbano" | "rural" } — opcional, para cargar solo un tipo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ comunaCode: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN parentZonaId TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN sector TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN tipoSector TEXT`).catch(() => {});

  const { comunaCode } = await params;
  const body = await req.json().catch(() => ({}));
  const soloTipo = body.soloTipo as "urbano" | "rural" | undefined;

  let parentZona: any = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, precioPorLitro, litrosMinimos, comunaCode, codRegion FROM AkuoZona WHERE comunaCode = ? AND parentZonaId IS NULL LIMIT 1`,
      comunaCode
    );
    if (Array.isArray(r) && r.length > 0) parentZona = r[0];
  } catch {}

  if (!parentZona) {
    return NextResponse.json({ error: "Primero activá la comuna como zona antes de cargar localidades" }, { status: 400 });
  }

  const comunaData = (localidadesData as any).localidadesPorComuna?.find((c: any) => c.codComuna === comunaCode);
  if (!comunaData || !comunaData.localidades || comunaData.localidades.length === 0) {
    return NextResponse.json({ error: "No hay localidades predefinidas para esta comuna" }, { status: 404 });
  }

  const localidades = soloTipo
    ? comunaData.localidades.filter((l: any) => l.tipo === soloTipo)
    : comunaData.localidades;

  if (localidades.length === 0) {
    return NextResponse.json({ error: `No hay localidades de tipo "${soloTipo}" para esta comuna` }, { status: 404 });
  }

  let existingSubZonas: any[] = [];
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, sector FROM AkuoZona WHERE parentZonaId = ?`,
      parentZona.id
    );
    existingSubZonas = Array.isArray(r) ? r : [];
  } catch {}
  const existingNames = new Set(existingSubZonas.map((sz: any) => (sz.sector || sz.nombre || "").toLowerCase()));

  const ahora = new Date().toISOString();
  const parentPrecio = parentZona.precioPorLitro ?? 50;
  const parentLitrosMin = parentZona.litrosMinimos ?? 1000;

  let creadas = 0;
  let saltadas = 0;

  for (const loc of localidades) {
    const sectorName = loc.nombre.trim();
    if (existingNames.has(sectorName.toLowerCase())) { saltadas++; continue; }

    const subZonaId = `zona_sub_${comunaCode}_${Date.now()}_${creadas}`;
    const radioKm = loc.tipo === "urbano" ? 3 : 8;

    try {
      await akuosplashDb.$executeRawUnsafe(
        `INSERT INTO AkuoZona (id, creadoEn, actualizadoEn, nombre, descripcion,
          zonaGeoJson, centroLat, centroLng, radioKm,
          precioPorLitro, precioMinimoPorLitro, precioMinimoTotal, precioMaximoPorLitro,
          litrosMinimos, activa, comunaCode, codRegion, parentZonaId, sector, tipoSector)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?)`,
        subZonaId, ahora, ahora, sectorName,
        `Sub-zona ${loc.tipo} de ${sectorName}`,
        JSON.stringify({ type: "Polygon", coordinates: [] }),
        loc.lat, loc.lng, radioKm,
        parentPrecio, parentLitrosMin, 0,
        comunaCode, parentZona.codRegion ?? null,
        parentZona.id, sectorName, loc.tipo
      );
      creadas++;
    } catch (e: any) {
      console.error("[auto-popular] error creando", sectorName, e?.message);
    }
  }

  return NextResponse.json({
    ok: true,
    comuna: comunaData.comuna,
    totalLocalidades: localidades.length,
    creadas,
    saltadas,
    message: `${creadas} sub-zonas creadas (${saltadas} ya existían). Todas inactivas — activá las que necesites.`,
  });
}
