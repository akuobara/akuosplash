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

  const url = new URL(req.url);
  const regionFiltro = url.searchParams.get("region");

  // Cargar todas las zonas existentes (para marcar comunas ya configuradas)
  // Usar raw SQL porque AkuoZona puede tener columnas nuevas
  let zonas: any[] = [];
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, nombre, zonaGeoJson, centroLat, centroLng, precioPorLitro,
              precioMinimoPorLitro, precioMinimoTotal, precioMaximoPorLitro,
              litrosMinimos, radioKm, activa, comunaCode, codRegion,
              parentZonaId, sector, tipoSector
       FROM AkuoZona WHERE 1=1`
    );
    zonas = Array.isArray(r) ? r : [];
  } catch (e: any) {
    // Si las columnas nuevas no existen, intentar sin ellas
    try {
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT id, nombre, zonaGeoJson, centroLat, centroLng, precioPorLitro,
                precioMinimoPorLitro, precioMinimoTotal, precioMaximoPorLitro,
                litrosMinimos, radioKm, activa
         FROM AkuoZona WHERE 1=1`
      );
      zonas = Array.isArray(r) ? r : [];
    } catch (e2: any) {
      console.error("[regiones-comunas] no se pudo cargar AkuoZona:", e2?.message);
    }
  }

  // Indexar zonas por nombre (que coincide con el nombre de la comuna)
  const zonaByNombre: Record<string, any> = {};
  const zonaByCode: Record<string, any> = {};
  // Indexar sub-zonas por parentZonaId
  const subZonasByParent: Record<string, any[]> = {};
  for (const z of zonas) {
    zonaByNombre[(z.nombre || "").toLowerCase()] = z;
    if (z.comunaCode) zonaByCode[z.comunaCode] = z;
    if (z.parentZonaId) {
      if (!subZonasByParent[z.parentZonaId]) subZonasByParent[z.parentZonaId] = [];
      subZonasByParent[z.parentZonaId].push(z);
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
