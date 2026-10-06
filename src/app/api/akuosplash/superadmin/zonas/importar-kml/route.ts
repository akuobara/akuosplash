import { NextRequest, NextResponse } from "next/server";
import { akuosplashDb } from "@/lib/akuosplash-db";
import { akuoGetCurrentUser } from "@/lib/akuosplash-auth";

// POST /api/akuosplash/superadmin/zonas/importar-kml
// Igual que en Aljibe: subí un archivo KML de Google Earth y se crea la zona
// automáticamente. Acepta multipart/form-data con campo "file" o JSON con { kml, nombre, precioPorLitro }
function kmlToGeoJson(kmlContent: string): { geoJson: string; nombre: string | null } | null {
  const nombreMatch = kmlContent.match(/<name>([^<]*)<\/name>/i);
  const nombre = nombreMatch ? nombreMatch[1].trim() : null;
  const coordsMatch = kmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (!coordsMatch) return null;
  const rawCoords = coordsMatch[1].trim();
  const coordPairs = rawCoords.split(/[\s\n]+/).filter((s: string) => s.trim());
  const coordinates = coordPairs.map((pair: string) => {
    const parts = pair.split(",").map((s: string) => parseFloat(s.trim()));
    return [parts[0], parts[1]];
  });
  if (coordinates.length < 3) return null;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([...first]);
  }
  const geoJson = JSON.stringify({ type: "Polygon", coordinates: [coordinates] });
  return { geoJson, nombre };
}

export async function POST(req: NextRequest) {
  const user = await akuoGetCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "superadmin") return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    let kmlContent = "";
    let nombreOverride: string | undefined;
    let precioOverride: number | undefined;
    let litrosMinimosOverride: number | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) return NextResponse.json({ error: "No se encontró el archivo KML" }, { status: 400 });
      kmlContent = await file.text();
      nombreOverride = (formData.get("nombre") as string) || undefined;
      const precio = formData.get("precioPorLitro") as string;
      if (precio) precioOverride = Number(precio);
      const minL = formData.get("litrosMinimos") as string;
      if (minL) litrosMinimosOverride = Number(minL);
    } else {
      const body = await req.json();
      kmlContent = body.kml || "";
      nombreOverride = body.nombre;
      precioOverride = body.precioPorLitro ? Number(body.precioPorLitro) : undefined;
      litrosMinimosOverride = body.litrosMinimos ? Number(body.litrosMinimos) : undefined;
    }

    if (!kmlContent.trim()) return NextResponse.json({ error: "El contenido KML está vacío" }, { status: 400 });

    const result = kmlToGeoJson(kmlContent);
    if (!result) {
      return NextResponse.json(
        { error: "No se pudo extraer un polígono del KML. Asegurate de que el archivo tenga un <Polygon> con <coordinates>." },
        { status: 400 }
      );
    }

    const nombre = (nombreOverride || result.nombre || "Zona importada").trim();
    const precioPorLitro = precioOverride ?? 50;

    // Calcular centro del polígono
    const geoJsonObj = JSON.parse(result.geoJson);
    const coords = geoJsonObj.coordinates[0];
    const centroLng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
    const centroLat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;

    const zona = await akuosplashDb.akuoZona.create({
      data: {
        nombre,
        descripcion: `Importada desde KML (${new Date().toLocaleDateString("es-CL")})`,
        zonaGeoJson: result.geoJson,
        centroLat,
        centroLng,
        precioPorLitro,
        litrosMinimos: litrosMinimosOverride ?? 1000,
        activa: true,
      },
    });

    return NextResponse.json({
      ok: true,
      zona,
      message: `Zona "${nombre}" creada con ${coords.length - 1} puntos`,
    }, { status: 201 });
  } catch (err) {
    console.error("[importar-kml akuo] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar el KML" },
      { status: 500 }
    );
  }
}
