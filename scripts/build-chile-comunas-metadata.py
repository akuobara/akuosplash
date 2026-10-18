#!/usr/bin/env python3
"""Descarga los 16 archivos de caracena/chile-geojson, extrae metadata compacta
(nombres + códigos + centroid de cada comuna) y la guarda en src/data/chile-comunas-metadata.json
NO incluye los polígonos (se cargan lazy desde GitHub raw cuando se necesitan para el mapa).
"""
import json
import os
import urllib.request
import sys

OUT_DIR = "src/data"
OUT_FILE = os.path.join(OUT_DIR, "chile-comunas-metadata.json")
RAW_BASE = "https://raw.githubusercontent.com/caracena/chile-geojson/master"

REGIONES_NOMBRE = {
    1: "Región de Tarapacá",
    2: "Región de Antofagasta",
    3: "Región de Atacama",
    4: "Región de Coquimbo",
    5: "Región de Valparaíso",
    6: "Región del Libertador General Bernardo O'Higgins",
    7: "Región del Maule",
    8: "Región del Biobío",
    9: "Región de La Araucanía",
    10: "Región de Los Lagos",
    11: "Región de Aysén del General Carlos Ibáñez del Campo",
    12: "Región de Magallanes y de la Antártica Chilena",
    13: "Región Metropolitana de Santiago",
    14: "Región de Los Ríos",
    15: "Región de Arica y Parinacota",
    16: "Región de Ñuble",
}

def compute_centroid(polygon_coords):
    """Computa el centroide (promedio de vértices) de un polígono.
    polygon_coords es [[[lng,lat],[lng,lat],...], ...] (lista de anillos; el primero es el exterior)
    Para simplicidad, usamos el promedio de todos los puntos del anillo exterior."""
    if not polygon_coords or not polygon_coords[0]:
        return None, None
    outer = polygon_coords[0]
    if len(outer) == 0:
        return None, None
    lng_sum = sum(p[0] for p in outer)
    lat_sum = sum(p[1] for p in outer)
    n = len(outer)
    return round(lat_sum / n, 6), round(lng_sum / n, 6)

def compute_centroid_better(polygon_coords):
    """Centroide basado en el bounding box del anillo exterior — más estable que el promedio
    de vértices (porque las comunas suelen tener vértices más densos en la costa o frontera)."""
    if not polygon_coords or not polygon_coords[0]:
        return None, None
    outer = polygon_coords[0]
    if len(outer) == 0:
        return None, None
    lngs = [p[0] for p in outer]
    lats = [p[1] for p in outer]
    return round((min(lats) + max(lats)) / 2, 6), round((min(lngs) + max(lngs)) / 2, 6)

def fetch_region(region_num):
    url = f"{RAW_BASE}/{region_num}.geojson"
    print(f"  → Descargando {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return data
    except Exception as e:
        print(f"    ✗ Error: {e}")
        return None

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    regiones = {}
    comunas = []

    for region_num in range(1, 17):
        data = fetch_region(region_num)
        if not data:
            continue
        region_nombre = REGIONES_NOMBRE.get(region_num, f"Región {region_num}")
        regiones[str(region_num)] = {
            "codregion": region_num,
            "nombre": region_nombre,
            "comunasCount": 0,
        }

        features = data.get("features", [])
        for f in features:
            props = f.get("properties", {})
            geom = f.get("geometry", {})
            polygon = geom.get("coordinates", []) if geom.get("type") == "Polygon" else []
            centroid_lat, centroid_lng = compute_centroid_better(polygon)

            comuna = {
                "codComuna": str(props.get("cod_comuna") or props.get("cod_comun") or ""),
                "nombre": props.get("Comuna", "").strip(),
                "codRegion": region_num,
                "region": region_nombre,
                "provincia": props.get("Provincia", "").strip(),
                "centroidLat": centroid_lat,
                "centroidLng": centroid_lng,
                "poligonoUrl": f"{RAW_BASE}/{region_num}.geojson",
            }
            comunas.append(comuna)
            regiones[str(region_num)]["comunasCount"] = regiones[str(region_num)].get("comunasCount", 0) + 1

        print(f"    ✓ {len(features)} comunas en región {region_num} ({region_nombre})")

    metadata = {
        "regiones": list(regiones.values()),
        "comunas": comunas,
        "totalRegiones": len(regiones),
        "totalComunas": len(comunas),
        "source": "https://github.com/caracena/chile-geojson",
        "polygonsBaseUrl": RAW_BASE,
    }

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(OUT_FILE)
    print(f"\n=== Resumen ===")
    print(f"Total regiones: {metadata['totalRegiones']}")
    print(f"Total comunas: {metadata['totalComunas']}")
    print(f"Tamaño archivo metadata: {size:,} bytes ({size/1024:.1f} KB)")
    print(f"Guardado en: {OUT_FILE}")
    print(f"\nPolygons se cargan lazy desde: {RAW_BASE}/<region_num>.geojson")

if __name__ == "__main__":
    main()
