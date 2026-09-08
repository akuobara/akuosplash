// POST /api/super-admin/zonas/importar-kml
// Acepta un archivo KML (de Google Earth) y crea una zona automáticamente.
// El KML puede venir como:
// - multipart/form-data con campo "file" (archivo KML)
// - application/json con { kml: "<kml content>", nombre: "...", precioPorLitro: 9 }
//
// El endpoint extrae el polígono del KML, lo convierte a GeoJSON y crea la zona.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function checkSuperAdmin() {
  const session = await getSession();
  if (!session || session.role !== "super_admin") return null;
  return session;
}

// Extrae coordenadas de un string KML.
// Busca todos los <coordinates> dentro de <Polygon> y los convierte a GeoJSON.
function kmlToGeoJson(kmlContent: string): { geoJson: string; nombre: string | null } | null {
  // Buscar el nombre del placemark
  const nombreMatch = kmlContent.match(/<name>([^<]*)<\/name>/i);
  const nombre = nombreMatch ? nombreMatch[1].trim() : null;

  // Buscar todas las coordenadas en <coordinates>...</coordinates>
  // Las coordenadas en KML son: lng,lat,alt lng,lat,alt ...
  const coordsMatch = kmlContent.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (!coordsMatch) return null;

  const rawCoords = coordsMatch[1].trim();
  // Separar por espacios, tabs o nuevasñas
  const coordPairs = rawCoords.split(/[\s\n]+/).filter((s: string) => s.trim());

  // Convertir cada par a [lng, lat] (ignorando altitud)
  const coordinates = coordPairs.map((pair: string) => {
    const parts = pair.split(",").map((s: string) => parseFloat(s.trim()));
    return [parts[0], parts[1]]; // [lng, lat]
  });

  if (coordinates.length < 3) return null;

  // Asegurar que el polígono esté cerrado (primer punto = último punto)
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coordinates.push([...first]);
  }

  // Calcular centro aproximado (promedio de coordenadas)
  const centroLng = coordinates.reduce((s: number, c: number[]) => s + c[0], 0) / coordinates.length;
  const centroLat = coordinates.reduce((s: number, c: number[]) => s + c[1], 0) / coordinates.length;

  const geoJson = JSON.stringify({
    type: "Polygon",
    coordinates: [coordinates],
  });

  return { geoJson, nombre };
}

export async function POST(req: NextRequest) {
  const session = await checkSuperAdmin();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    let kmlContent = "";
    let nombreOverride: string | undefined;
    let precioOverride: number | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // FormData con archivo
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No se encontró el archivo KML" }, { status: 400 });
      }
      kmlContent = await file.text();
      nombreOverride = (formData.get("nombre") as string) || undefined;
      const precio = formData.get("precioPorLitro") as string;
      if (precio) precioOverride = Number(precio);
    } else {
      // JSON con kml content
      const body = await req.json();
      kmlContent = body.kml || "";
      nombreOverride = body.nombre;
      precioOverride = body.precioPorLitro ? Number(body.precioPorLitro) : undefined;
    }

    if (!kmlContent.trim()) {
      return NextResponse.json({ error: "El contenido KML está vacío" }, { status: 400 });
    }

    // Convertir KML a GeoJSON
    const result = kmlToGeoJson(kmlContent);
    if (!result) {
      return NextResponse.json(
        { error: "No se pudo extraer un polígono del KML. Asegúrate de que el archivo tenga un <Polygon> con <coordinates>." },
        { status: 400 }
      );
    }

    const nombre = (nombreOverride || result.nombre || "Zona importada").trim();
    const precioPorLitro = precioOverride || 9;

    // Calcular centro
    const geoJsonObj = JSON.parse(result.geoJson);
    const coords = geoJsonObj.coordinates[0];
    const centroLng = coords.reduce((s: number, c: number[]) => s + c[0], 0) / coords.length;
    const centroLat = coords.reduce((s: number, c: number[]) => s + c[1], 0) / coords.length;

    // Crear la zona
    const zona = await db.zona.create({
      data: {
        nombre,
        descripcion: `Importada desde KML (${new Date().toLocaleDateString("es-CL")})`,
        zonaGeoJson: result.geoJson,
        centroLat,
        centroLng,
        precioPorLitro,
        activa: true,
      },
    });

    return NextResponse.json({
      ok: true,
      zona,
      message: `Zona "${nombre}" creada con ${coords.length - 1} puntos`,
    }, { status: 201 });
  } catch (err) {
    console.error("[importar-kml] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar el KML" },
      { status: 500 }
    );
  }
}
