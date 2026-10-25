#!/usr/bin/env python3
"""Agrega un record DNS TXT (verificación de Google) en akuosplash.cl via Vercel."""
import json
import urllib.request
import urllib.error

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
DOMAIN = "akuosplash.cl"

# Record TXT de verificación de Google Workspace
TXT_VALUE = "google-site-verification=we4VDwF0e5Rr-6WavNWHBd25mp4U8Jwaqe5G6YBC8ZA"

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

# Listar records actuales del dominio
print(f"==> Records actuales de {DOMAIN}")
s, r = api("GET", f"/v4/domains/{DOMAIN}/records")
if s == 200:
    records = r.get("records", [])
    print(f"   Total: {len(records)}")
    for rec in records:
        print(f"   - type={rec.get('type')} name={rec.get('name')} value={str(rec.get('value',''))[:60]}")
else:
    print(f"   HTTP {s}: {json.dumps(r)[:300]}")

# Agregar el record TXT (name="" significa root/apex)
print(f"\n==> Agregando record TXT verificación Google")
s, r = api("POST", f"/v4/domains/{DOMAIN}/records", body={
    "name": "",
    "type": "TXT",
    "value": TXT_VALUE,
    "ttl": 3600,
})
print(f"   HTTP {s}: {json.dumps(r)[:300]}")

if s in (200, 201):
    print(f"   ✅ Record TXT agregado")
else:
    print(f"   ⚠️  Revisá el error arriba")

# Verificar
print(f"\n==> Records finales de {DOMAIN}")
s, r = api("GET", f"/v4/domains/{DOMAIN}/records")
if s == 200:
    records = r.get("records", [])
    print(f"   Total: {len(records)}")
    for rec in records:
        print(f"   - type={rec.get('type')} name={rec.get('name')} value={str(rec.get('value',''))[:80]}")
