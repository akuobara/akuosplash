import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";

// POST /api/akuosplash/admin/regiones-comunas/[comunaCode]/sub-zonas
// Crea una sub-zona dentro de una comuna (sector urbano o rural).
// Body: {
//   sector: string,          // nombre del sector (ej: "Pan de Azúcar", "Cruz de Caña")
//   tipoSector: "urbano" | "rural",
//   centroLat: number,
//   centroLng: number,
//   radioKm?: number,       // radio de cobertura (default 5km)
//   activa?: boolean,        // default true
//   precioPorLitro?: number, // override del precio de la comuna (opcional)
//   litrosMinimos?: number,  // override (opcional)
// }
export async function POST(req: NextRequest, { params }: { params: Promise<{ comunaCode: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();

  const { comunaCode } = await params;
  const body = await req.json();

  if (!body.sector?.trim()) return NextResponse.json({ error: "Nombre del sector obligatorio" }, { status: 400 });
  if (!body.tipoSector || !["urbano", "rural"].includes(body.tipoSector)) {
    return NextResponse.json({ error: "tipoSector debe ser 'urbano' o 'rural'" }, { status: 400 });
  }
  if (typeof body.centroLat !== "number" || typeof body.centroLng !== "number") {
    return NextResponse.json({ error: "centroLat y centroLng son obligatorios" }, { status: 400 });
  }

  // Buscar la zona padre (la comuna) para heredar precios por defecto
  let parentZonaId: string | null = null;
  let parentPrecio = 50;
  let parentLitrosMin = 1000;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, precioPorLitro, litrosMinimos FROM AkuoZona WHERE comunaCode = ? LIMIT 1`,
      comunaCode
    );
    if (Array.isArray(r) && r.length > 0) {
      parentZonaId = r[0].id;
      parentPrecio = r[0].precioPorLitro ?? 50;
      parentLitrosMin = r[0].litrosMinimos ?? 1000;
    }
  } catch {}

  if (!parentZonaId) {
    return NextResponse.json({ error: "Primero debés activar la comuna como zona antes de agregar sub-zonas" }, { status: 400 });
  }

  const subZonaId = `zona_sub_${comunaCode}_${Date.now()}`;
  const ahora = new Date().toISOString();
  const radioKm = body.radioKm ?? 5;

  try {
    await akuosplashDb.$executeRawUnsafe(
      `INSERT INTO AkuoZona (id, creadoEn, actualizadoEn, nombre, descripcion,
        zonaGeoJson, centroLat, centroLng, radioKm,
        precioPorLitro, precioMinimoPorLitro, precioMinimoTotal, precioMaximoPorLitro,
        litrosMinimos, activa, comunaCode, parentZonaId, sector, tipoSector)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)`,
      subZonaId, ahora, ahora,
      body.sector.trim(),
      `Sub-zona ${body.tipoSector} de ${body.sector}`,
      JSON.stringify({ type: "Polygon", coordinates: [] }),
      body.centroLat,
      body.centroLng,
      radioKm,
      body.precioPorLitro ?? parentPrecio,  // hereda del padre si no se especifica
      body.litrosMinimos ?? parentLitrosMin,
      body.activa === false ? 0 : 1,
      comunaCode,
      parentZonaId,
      body.sector.trim(),
      body.tipoSector
    );
    return NextResponse.json({ ok: true, id: subZonaId, sector: body.sector });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "No se pudo crear" }, { status: 500 });
  }
}
