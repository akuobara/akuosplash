import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
import chileMetadata from "@/data/chile-comunas-metadata.json";

// GET /api/akuosplash/admin/regiones-comunas
// Devuelve el árbol de regiones → comunas de Chile, con su estado actual
// (activo/inactivo como zona en AkuoSplash, precios, etc.).
// Query: ?region=13 para filtrar por región.
export async function GET(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  // Asegurar columnas de sub-zonas explícitamente
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN parentZonaId TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN sector TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN tipoSector TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN comunaCode TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN codRegion INTEGER`).catch(() => {});

  const url = new URL(req.url);
  const regionFiltro = url.searchParams.get("region");

  // Cargar todas las zonas (con sub-zonas incluidas)
  let zonas: any[] = [];
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, nombre, centroLat, centroLng, precioPorLitro,
              litrosMinimos, radioKm, activa, comunaCode, codRegion,
              parentZonaId, sector, tipoSector
       FROM AkuoZona WHERE 1=1`
    );
    zonas = Array.isArray(r) ? r : [];
  } catch (e: any) {
    console.error("[regiones-comunas] query failed:", e?.message);
    try {
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT id, nombre, centroLat, centroLng, precioPorLitro,
                litrosMinimos, radioKm, activa
         FROM AkuoZona WHERE 1=1`
      );
      zonas = Array.isArray(r) ? r : [];
    } catch (e2: any) {
      console.error("[regiones-comunas] fallback failed:", e2?.message);
    }
  }

  // Indexar zonas por nombre (que coincide con el nombre de la comuna)
  // IMPORTANTE: solo indexar ZONAS PADRE (sin parentZonaId) en zonaByCode/zonaByNombre.
  // Las sub-zonas comparten el mismo comunaCode que su padre, y si las indexamos también,
  // sobrescriben al padre y luego no se encuentran las sub-zonas.
  const zonaByNombre: Record<string, any> = {};
  const zonaByCode: Record<string, any> = {};
  // Indexar sub-zonas por parentZonaId
  const subZonasByParent: Record<string, any[]> = {};
  for (const z of zonas) {
    if (z.parentZonaId) {
      // Es una sub-zona — solo indexar en subZonasByParent
      if (!subZonasByParent[z.parentZonaId]) subZonasByParent[z.parentZonaId] = [];
      subZonasByParent[z.parentZonaId].push(z);
    } else {
      // Es una zona padre — indexar en zonaByCode y zonaByNombre
      zonaByNombre[(z.nombre || "").toLowerCase()] = z;
      if (z.comunaCode) zonaByCode[z.comunaCode] = z;
    }
  }

  // Filtrar comunas por región si se especifica
  let comunas = (chileMetadata as any).comunas as any[];
  if (regionFiltro) {
    const codRegion = parseInt(regionFiltro);
    comunas = comunas.filter(c => c.codRegion === codRegion);
  }

  // Para cada comuna, agregar su estado de zona si existe + sub-zonas
  const comunasConEstado = comunas.map(c => {
    const zona = zonaByCode[c.codComuna] || zonaByNombre[c.nombre.toLowerCase()];
    const subZonas = zona ? (subZonasByParent[zona.id] || []) : [];
    return {
      ...c,
      zona: zona ? {
        id: zona.id,
        activa: !!zona.activa,
        precioPorLitro: zona.precioPorLitro,
        precioMinimoPorLitro: zona.precioMinimoPorLitro,
        precioMinimoTotal: zona.precioMinimoTotal,
        precioMaximoPorLitro: zona.precioMaximoPorLitro,
        litrosMinimos: zona.litrosMinimos,
        radioKm: zona.radioKm,
      } : null,
      subZonas: subZonas.map(sz => ({
        id: sz.id,
        nombre: sz.nombre,
        sector: sz.sector,
        tipoSector: sz.tipoSector,
        activa: !!sz.activa,
        centroLat: sz.centroLat,
        centroLng: sz.centroLng,
        radioKm: sz.radioKm,
        precioPorLitro: sz.precioPorLitro,
        litrosMinimos: sz.litrosMinimos,
      })),
    };
  });

  // Estadísticas
  const totalComunas = comunas.length;
  const totalActivas = comunasConEstado.filter(c => c.zona?.activa).length;
  const totalConfiguradas = comunasConEstado.filter(c => c.zona).length;

  return NextResponse.json({
    regiones: (chileMetadata as any).regiones,
    comunas: comunasConEstado,
    totalRegiones: (chileMetadata as any).totalRegiones,
    totalComunas,
    totalConfiguradas,
    totalActivas,
    polygonsBaseUrl: (chileMetadata as any).polygonsBaseUrl,
  });
}
