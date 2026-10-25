#!/usr/bin/env python3
"""
Crea el proyecto AkuoSplash en Vercel y carga las env vars.
NO hace deploy del código (eso lo hace el CLI después).
"""
import os
import json
import urllib.request
import urllib.parse

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
PROJECT_NAME = "akuosplash"
ENV_FILE = "/home/z/my-project-akuosplash/.env"

BASE = "https://api.vercel.com"

def api(method, path, body=None, headers=None):
    url = f"{BASE}{path}"
    if "?teamId=" not in url and "teamId" not in (body or {}):
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}teamId={TEAM}"
    h = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# ---------- 1) Crear proyecto ----------
print(f"==> [1/3] Creando project '{PROJECT_NAME}' en team {TEAM}")
status, resp = api("POST", "/v11/projects", body={
    "name": PROJECT_NAME,
    "framework": "nextjs",
})
print(f"   HTTP {status}")
if status in (200, 201):
    PROJECT_ID = resp["id"]
    print(f"   ✅ Project creado: id={PROJECT_ID}")
elif status == 409:
    # ya existe
    PROJECT_ID = resp.get("id") or resp.get("projectId")
    # buscar el project por nombre
    s2, r2 = api("GET", f"/v9/projects/{PROJECT_NAME}")
    if s2 == 200:
        PROJECT_ID = r2["id"]
    print(f"   ℹ️ Project ya existía: id={PROJECT_ID}")
else:
    print(f"   ❌ Error: {json.dumps(resp)[:300]}")
    raise SystemExit(1)

# ---------- 2) Cargar env vars ----------
print(f"==> [2/3] Cargando env vars desde {ENV_FILE}")
with open(ENV_FILE) as f:
    lines = f.readlines()

# Parsear el .env (skipping comments and empty lines)
env_vars = []
for line in lines:
    line = line.rstrip("\n")
    if not line or line.startswith("#"):
        continue
    if "=" not in line:
        continue
    key, _, val = line.partition("=")
    key = key.strip()
    val = val.strip()
    # Quitar comillas si las tiene
    if val.startswith('"') and val.endswith('"'):
        val = val[1:-1]
    if not key:
        continue
    env_vars.append((key, val))

print(f"   Total vars a cargar: {len(env_vars)}")
ok = 0
skipped = 0
errored = 0

for key, val in env_vars:
    # Saltar vars vacías
    if not val:
        print(f"   ⏭️  {key}=<vacío> — skipped (no tiene valor)")
        skipped += 1
        continue
    body = {
        "key": key,
        "value": val,
        "type": "encrypted",
        "target": ["production", "preview", "development"],
    }
    status, resp = api("POST", f"/v10/projects/{PROJECT_ID}/env", body=body)
    if status in (200, 201):
        print(f"   ✅ {key} cargada")
        ok += 1
    elif status == 409:
        # ya existe, intentar update
        # primero obtener la env var existente
        s2, r2 = api("GET", f"/v9/projects/{PROJECT_ID}/env")
        existing_id = None
        if s2 == 200:
            for ev in r2.get("envs", []):
                if ev.get("key") == key:
                    existing_id = ev.get("id")
                    break
        if existing_id:
            body_upd = {
                "value": val,
                "type": "encrypted",
                "target": ["production", "preview", "development"],
            }
            s3, r3 = api("PATCH", f"/v10/projects/{PROJECT_ID}/env/{existing_id}", body=body_upd)
            if s3 in (200, 201):
                print(f"   🔄 {key} actualizada (ya existía)")
                ok += 1
            else:
                print(f"   ❌ {key} no se pudo actualizar: HTTP {s3} {json.dumps(r3)[:200]}")
                errored += 1
        else:
            print(f"   ⚠️  {key} ya existe pero no la encontré para actualizar")
            errored += 1
    else:
        print(f"   ❌ {key} HTTP {status}: {json.dumps(resp)[:200]}")
        errored += 1

print(f"\nResumen env vars:")
print(f"  ✅ Cargadas/actualizadas: {ok}")
print(f"  ⏭️  Skipped (vacías): {skipped}")
print(f"  ❌ Errores: {errored}")
print(f"\nPROJECT_ID={PROJECT_ID}")
print("OK")
