#!/usr/bin/env python3
"""
Actualiza NEXT_PUBLIC_APP_URL en el project akuosplash de Vercel
para apuntar al dominio de producción correcto.
"""
import json
import urllib.request
import urllib.error

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"
NEW_APP_URL = "https://akuosplash.vercel.app"

BASE = "https://api.vercel.com"

def api(method, path, body=None, headers=None):
    url = f"{BASE}{path}"
    if "?teamId=" not in url:
        url = f"{url}?teamId={TEAM}"
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

# 1) Buscar el env var NEXT_PUBLIC_APP_URL existente
print("==> [1] Buscando NEXT_PUBLIC_APP_URL en el proyecto")
status, resp = api("GET", f"/v9/projects/{PROJECT_ID}/env")
if status != 200:
    print(f"   ❌ HTTP {status}: {json.dumps(resp)[:300]}")
    raise SystemExit(1)

target_id = None
for e in resp.get("envs", []):
    if e.get("key") == "NEXT_PUBLIC_APP_URL":
        target_id = e.get("id")
        break

if not target_id:
    print("   ℹ️  No existe NEXT_PUBLIC_APP_URL, creando nuevo")
    body = {
        "key": "NEXT_PUBLIC_APP_URL",
        "value": NEW_APP_URL,
        "type": "encrypted",
        "target": ["production", "preview", "development"],
    }
    status, resp = api("POST", f"/v10/projects/{PROJECT_ID}/env", body=body)
    print(f"   ✅ Creada: HTTP {status}")
else:
    print(f"   ✅ Encontrada: id={target_id}")
    body = {
        "value": NEW_APP_URL,
        "type": "encrypted",
        "target": ["production", "preview", "development"],
    }
    status, resp = api("PATCH", f"/v10/projects/{PROJECT_ID}/env/{target_id}", body=body)
    print(f"   ✅ Actualizada: HTTP {status}")

print(f"\nNEXT_PUBLIC_APP_URL = {NEW_APP_URL}")
print("OK")
