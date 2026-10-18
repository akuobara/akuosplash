import { NextRequest, NextResponse } from "next/server";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { ensureAkuoConfigColumns } from "@/lib/akuosplash-plans";
import chileMetadata from "@/data/chile-comunas-metadata.json";

// PATCH /api/akuosplash/admin/regiones-comunas/[comunaCode]
// Activa, edita o desactiva una comuna como zona de AkuoSplash.
// Body: {
//   activa: boolean,                          // activar/desactivar
//   precioPorLitro?: number,                  // precio base por litro en CLP
//   precioMinimoPorLitro?: number | null,     // floor por litro
//   precioMinimoTotal?: number | null,         // floor total por viaje
//   precioMaximoPorLitro?: number | null,      // cap por litro (anti-surge)
//   litrosMinimos?: number,                    // litros mínimos por pedido
// }
// Si la comuna no tenía zona, crea una nueva con el polígono de la comuna.
// Si ya tenía, actualiza los campos enviados.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ comunaCode: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();

  // Auto-migrar las columnas comunaCode y codRegion si no existen en AkuoZona
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN comunaCode TEXT`).catch(() => {});
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN codRegion INTEGER`).catch(() => {});

  const { comunaCode } = await params;
  const body = await req.json();

  // Buscar la comuna en el metadata
  const comuna = (chileMetadata as any).comunas.find((c: any) => c.codComuna === comunaCode);
  if (!comuna) {
    return NextResponse.json({ error: `Comuna con código ${comunaCode} no encontrada` }, { status: 404 });
  }

  // Buscar si ya existe una zona para esta comuna
  let zona: any = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id, nombre, activa, precioPorLitro, precioMinimoPorLitro,
              precioMinimoTotal, precioMaximoPorLitro, litrosMinimos
       FROM AkuoZona WHERE comunaCode = ? LIMIT 1`,
      comunaCode
    );
    if (Array.isArray(r) && r.length > 0) zona = r[0];
  } catch (e: any) {
    // Si comunaCode no existe como columna, buscar por nombre
    try {
      const r: any = await akuosplashDb.$queryRawUnsafe(
        `SELECT id, nombre, activa, precioPorLitro, precioMinimoPorLitro,
                precioMinimoTotal, precioMaximoPorLitro, litrosMinimos
         FROM AkuoZona WHERE LOWER(nombre) = LOWER(?) LIMIT 1`,
        comuna.nombre
      );
      if (Array.isArray(r) && r.length > 0) zona = r[0];
    } catch {}
  }

  const ahora = new Date().toISOString();

  // Datos a actualizar/guardar
  const data: any = {
    activa: body.activa !== undefined ? (body.activa ? 1 : 0) : (zona?.activa ?? 1),
    precioPorLitro: body.precioPorLitro ?? zona?.precioPorLitro ?? 50,
    precioMinimoPorLitro: body.precioMinimoPorLitro ?? zona?.precioMinimoPorLitro ?? null,
    precioMinimoTotal: body.precioMinimoTotal ?? zona?.precioMinimoTotal ?? null,
    precioMaximoPorLitro: body.precioMaximoPorLitro ?? zona?.precioMaximoPorLitro ?? null,
    litrosMinimos: body.litrosMinimos ?? zona?.litrosMinimos ?? 1000,
  };

  if (zona) {
    // Actualizar la zona existente
    const setParts = [
      "activa = ?",
      "precioPorLitro = ?",
      "precioMinimoPorLitro = ?",
      "precioMinimoTotal = ?",
      "precioMaximoPorLitro = ?",
      "litrosMinimos = ?",
      "actualizadoEn = ?",
    ];
    const values = [
      data.activa,
      data.precioPorLitro,
      data.precioMinimoPorLitro,
      data.precioMinimoTotal,
      data.precioMaximoPorLitro,
      data.litrosMinimos,
      ahora,
      zona.id,
    ];
    await akuosplashDb.$executeRawUnsafe(
      `UPDATE AkuoZona SET ${setParts.join(", ")} WHERE id = ?`,
      ...values
    );
    return NextResponse.json({ ok: true, zonaId: zona.id, comuna: comuna.nombre, accion: "actualizada" });
  } else {
    // Crear una zona nueva para esta comuna
    // El polígono se carga lazy desde GitHub raw cuando se necesite dibujar en el mapa
    // Para el registro del cliente, usamos el centroid como punto de cobertura con radio amplio
    const zonaId = `zona_comuna_${comunaCode}_${Date.now()}`;
    const nombre = comuna.nombre;
    const radioKm = 15; // radio default de 15km desde el centroid
    const zonaGeoJson = JSON.stringify({
      type: "Polygon",
      coordinates: [],
      _note: "Polígono de la comuna se carga lazy desde " + comuna.poligonoUrl,
    });

    await akuosplashDb.$executeRawUnsafe(
      `INSERT INTO AkuoZona (id, creadoEn, actualizadoEn, nombre, descripcion,
        zonaGeoJson, centroLat, centroLng, radioKm,
        precioPorLitro, precioMinimoPorLitro, precioMinimoTotal, precioMaximoPorLitro,
        litrosMinimos, activa, comunaCode, codRegion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      zonaId, ahora, ahora,
      nombre,
      `Zona automática para la comuna de ${comuna.nombre}, región de ${comuna.region}`,
      zonaGeoJson,
      comuna.centroidLat,
      comuna.centroidLng,
      radioKm,
      data.precioPorLitro,
      data.precioMinimoPorLitro,
      data.precioMinimoTotal,
      data.precioMaximoPorLitro,
      data.litrosMinimos,
      data.activa,
      comunaCode,
      comuna.codRegion
    );

    return NextResponse.json({ ok: true, zonaId, comuna: comuna.nombre, accion: "creada" });
  }
}

// DELETE /api/akuosplash/admin/regiones-comunas/[comunaCode]
// Desactiva (soft delete) la zona de una comuna — no la elimina del todo para mantener históricos.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ comunaCode: string }> }) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  await ensureAkuoConfigColumns();
  await akuosplashDb.$executeRawUnsafe(`ALTER TABLE AkuoZona ADD COLUMN comunaCode TEXT`).catch(() => {});

  const { comunaCode } = await params;

  // Buscar la zona por comunaCode
  let zonaId: string | null = null;
  try {
    const r: any = await akuosplashDb.$queryRawUnsafe(
      `SELECT id FROM AkuoZona WHERE comunaCode = ? LIMIT 1`,
      comunaCode
    );
    if (Array.isArray(r) && r.length > 0) zonaId = r[0].id;
  } catch {}

  if (!zonaId) {
    return NextResponse.json({ error: "Zona no encontrada para esta comuna" }, { status: 404 });
  }

  // Soft delete: marcar como inactiva (no borrar)
  await akuosplashDb.$executeRawUnsafe(
    `UPDATE AkuoZona SET activa = 0, actualizadoEn = ? WHERE id = ?`,
    new Date().toISOString(), zonaId
  );

  return NextResponse.json({ ok: true, zonaId, accion: "desactivada" });
}
