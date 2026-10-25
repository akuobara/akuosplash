#!/usr/bin/env python3
"""
Carga DATABASE_URL y DATABASE_AUTH_TOKEN reales en el project akuosplash de Vercel.
Tambien carga los secrets faltantes (AKUO_MP_CLIENT_SECRET, etc) si los encuentra en scripts/.
"""
import json
import urllib.request
import urllib.error
import os
import re

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"

# Valores reales (encontrados en scripts viejos de AljibeApp)
REAL_DATABASE_URL = "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io"
REAL_DATABASE_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"

BASE = "https://api.vercel.com"

def api(method, path, body=None):
    url = f"{BASE}{path}"
    if "?teamId=" not in url:
        url = f"{url}?teamId={TEAM}"
    h = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def find_env_id(envs, key):
    for e in envs:
        if e.get("key") == key:
            return e.get("id")
    return None

# 1) Buscar IDs actuales de las vars
print("==> [1] Obteniendo vars actuales del project akuosplash")
status, resp = api("GET", f"/v9/projects/{PROJECT_ID}/env")
if status != 200:
    print(f"   ❌ HTTP {status}: {json.dumps(resp)[:300]}")
    raise SystemExit(1)
envs = resp.get("envs", [])
print(f"   Total vars: {len(envs)}")

# 2) Actualizar DATABASE_URL y AKUOSPLASH_DATABASE_URL (ambas apuntan a Turso ahora)
TARGETS = [
    ("DATABASE_URL", REAL_DATABASE_URL),
    ("AKUOSPLASH_DATABASE_URL", REAL_DATABASE_URL),
    ("DATABASE_AUTH_TOKEN", REAL_DATABASE_AUTH_TOKEN),
]

for key, value in TARGETS:
    env_id = find_env_id(envs, key)
    if env_id:
        body = {
            "value": value,
            "type": "encrypted",
            "target": ["production", "preview", "development"],
        }
        s, r = api("PATCH", f"/v10/projects/{PROJECT_ID}/env/{env_id}", body=body)
        if s in (200, 201):
            print(f"   ✅ {key} actualizada")
        else:
            print(f"   ❌ {key} HTTP {s}: {json.dumps(r)[:200]}")
    else:
        body = {
            "key": key,
            "value": value,
            "type": "encrypted",
            "target": ["production", "preview", "development"],
        }
        s, r = api("POST", f"/v10/projects/{PROJECT_ID}/env", body=body)
        if s in (200, 201):
            print(f"   ✅ {key} creada (nueva)")
        else:
            print(f"   ❌ {key} HTTP {s}: {json.dumps(r)[:200]}")

print("\n==> [2] Buscando otros secrets en scripts viejos de AljibeApp")
# Buscar otros secrets faltantes en los scripts viejos
scripts_dir = "/home/z/my-project/scripts"
extra_secrets = {}

if os.path.isdir(scripts_dir):
    for fname in os.listdir(scripts_dir):
        if not fname.endswith((".js", ".cjs", ".ts")):
            continue
        try:
            content = open(os.path.join(scripts_dir, fname)).read()
        except Exception:
            continue
        # AKUO_MP_CLIENT_SECRET — buscar valor literal
        for key, pattern in [
            ("AKUO_MP_CLIENT_SECRET", r"AKUO_MP_CLIENT_SECRET[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']"),
            ("AKUO_MP_SPLIT_ACCESS_TOKEN", r"AKUO_MP_SPLIT_ACCESS_TOKEN[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']"),
            ("TRANSBANK_API_KEY", r"TRANSBANK_API_KEY[\"']?\s*[:=]\s*[\"']([^\"']+)[\"']"),
            ("TRANSBANK_COMMERCE_CODE", r"TRANSBANK_COMMERCE_CODE[\"']?\s*[:=]\s*[\"']([0-9]+)[\"']"),
        ]:
            m = re.search(pattern, content)
            if m and key not in extra_secrets:
                extra_secrets[key] = m.group(1)

if extra_secrets:
    print(f"   Encontrados {len(extra_secrets)} secrets adicionales en scripts:")
    for k in extra_secrets:
        print(f"     - {k}")
    for key, value in extra_secrets.items():
        env_id = find_env_id(envs, key)
        # Crear nuevo si no existe (solo si no está ya cargado con valor real)
        # Buscar si la var existe (target no es None)
        exists_with_value = False
        for e in envs:
            if e.get("key") == key:
                # No la actualizamos si ya tiene valor
                exists_with_value = True
                break
        if exists_with_value:
            body = {"value": value, "type": "encrypted", "target": ["production", "preview", "development"]}
            s, r = api("PATCH", f"/v10/projects/{PROJECT_ID}/env/{env_id}", body=body)
            print(f"   ✅ {key} actualizada (desde scripts viejos) HTTP {s}")
        else:
            body = {"key": key, "value": value, "type": "encrypted", "target": ["production", "preview", "development"]}
            s, r = api("POST", f"/v10/projects/{PROJECT_ID}/env", body=body)
            print(f"   ✅ {key} creada desde scripts viejos HTTP {s}")
else:
    print("   No se encontraron más secrets en scripts viejos")

print("\n==> [3] Estado final del project")
s, r = api("GET", f"/v9/projects/{PROJECT_ID}/env")
final_envs = r.get("envs", [])
print(f"   Total vars: {len(final_envs)}")
for e in final_envs:
    print(f"     - {e.get('key')} (target={e.get('target')})")
