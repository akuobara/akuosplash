#!/usr/bin/env python3
"""Procesa los datos de GeoNames (CL.txt) y extrae localidades (poblados)
con sus coordenadas, comuna, y tipo (urbano/rural).

Crea src/data/chile-localidades.json que se usa para pre-poblar sub-zonas
cuando se activa una comuna en el selector de Regiones y Comunas.
"""
import json
import os
import sys
from collections import defaultdict

GEONAMES_FILE = "/tmp/CL_geonames/CL.txt"
OUT_DIR = "src/data"
OUT_FILE = os.path.join(OUT_DIR, "chile-localidades.json")

# Cargar metadata de comunas (para mapear cod_comuna → nombre)
with open(os.path.join(OUT_DIR, "chile-comunas-metadata.json"), "r", encoding="utf-8") as f:
    chile_meta = json.load(f)

# Mapear: cod_comuna (4-digit) → 5-digit INE code → info comuna
comuna_by_ine_code = {}
for c in chile_meta["comunas"]:
    cod4 = str(c["codComuna"])
    # Convertir a 5-digit INE code: pad with leading zero
    cod5 = f"{int(cod4):05d}" if cod4.isdigit() else cod4
    comuna_by_ine_code[cod5] = c
    comuna_by_ine_code[cod4] = c  # also by 4-digit

# Clasificar feature codes
URBAN_CODES = {"PPL", "PPLA", "PPLA2", "PPLA3", "PPLA4", "PPLA5", "PPLC", "PPLCH", "PPLX"}
RURAL_CODES = {"PPLL", "PPLF", "PPLG", "PPLR", "PPLS", "STLMT", "FRM", "FRMS"}

# Leer CL.txt
localidades = []
stats = {"total": 0, "urban": 0, "rural": 0, "unknown": 0, "matched_comuna": 0, "unmatched": 0}
localidades_by_comuna = defaultdict(list)

with open(GEONAMES_FILE, "r", encoding="utf-8") as f:
    for line in f:
        parts = line.strip().split("\t")
        if len(parts) < 13:
            continue

        feature_class = parts[6]  # P, T, S, etc.
        if feature_class != "P":  # Solo populated places
            continue

        name = parts[1]
        lat = float(parts[4])
        lng = float(parts[5])
        feature_code = parts[7]
        admin3 = parts[12]  # comuna code (5-digit INE)

        if not admin3:
            continue

        # Clasificar como urbano o rural
        if feature_code in URBAN_CODES:
            tipo = "urbano"
            stats["urban"] += 1
        elif feature_code in RURAL_CODES:
            tipo = "rural"
            stats["rural"] += 1
        else:
            # PPL default = urbano
            tipo = "urbano"
            stats["urban"] += 1

        stats["total"] += 1

        # Mapear a comuna
        comuna = comuna_by_ine_code.get(admin3)
        if not comuna:
            # Probar con 4-digit
            cod4 = str(int(admin3)) if admin3.isdigit() and admin3.startswith("0") else admin3
            comuna = comuna_by_ine_code.get(cod4)

        if comuna:
            stats["matched_comuna"] += 1
            localidades_by_comuna[comuna["codComuna"]].append({
                "nombre": name,
                "tipo": tipo,
                "lat": lat,
                "lng": lng,
                "codComuna": comuna["codComuna"],
                "comuna": comuna["nombre"],
                "codRegion": comuna["codRegion"],
                "region": comuna["region"],
            })
        else:
            stats["unmatched"] += 1

# Convertir el dict a lista
localidades_list = []
for cod_comuna, locs in localidades_by_comuna.items():
    # Ordenar: urbanos primero, luego rurales, por nombre
    locs.sort(key=lambda l: (l["tipo"] != "urbano", l["nombre"]))
    localidades_list.append({
        "codComuna": cod_comuna,
        "comuna": locs[0]["comuna"] if locs else "",
        "codRegion": locs[0]["codRegion"] if locs else None,
        "localidades": locs,
    })

# Guardar
os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT_FILE, "w", encoding="utf-8") as f:
    json.dump({
        "localidadesPorComuna": localidades_list,
        "totalLocalidades": stats["total"],
        "totalUrbanas": stats["urban"],
        "totalRurales": stats["rural"],
        "totalComunasConLocalidades": len(localidades_list),
        "source": "GeoNames (http://download.geonames.org/export/dump/CL.zip)",
    }, f, ensure_ascii=False, separators=(",", ":"))

size = os.path.getsize(OUT_FILE)
print(f"\n=== Resumen ===")
print(f"Total localidades (populated places): {stats['total']}")
print(f"  Urbanas: {stats['urban']}")
print(f"  Rurales: {stats['rural']}")
print(f"Comunas con localidades: {len(localidades_list)}")
print(f"Tamaño archivo: {size:,} bytes ({size/1024:.1f} KB)")
print(f"Guardado en: {OUT_FILE}")

# Mostrar ejemplos
print(f"\n=== Ejemplos ===")
for entry in localidades_list[:3]:
    print(f"\nComuna: {entry['comuna']} ({entry['codComuna']}) — {len(entry['localidades'])} localidades:")
    for loc in entry["localidades"][:5]:
        print(f"  {loc['tipo']:7s} {loc['nombre']:30s} ({loc['lat']}, {loc['lng']})")
