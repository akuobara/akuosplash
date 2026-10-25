#!/usr/bin/env python3
"""
Mover el dominio akuosplash.cl + www.akuosplash.cl del project AljibeApp (my-project)
al nuevo project akuosplash. No toca DNS (ya apunta a Vercel).
"""
import json
import urllib.request
import urllib.error
import time

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
ALJIBE_PROJECT = "my-project"  # nombre (string) del project AljibeApp
NEW_PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"  # ID del project akuosplash
DOMAINS_TO_MOVE = ["www.akuosplash.cl", "akuosplash.cl"]  # www primero para que no se rompa el redirect

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

# 1) Remover dominios del project AljibeApp
for domain in DOMAINS_TO_MOVE:
    print(f"==> Removiendo {domain} del project AljibeApp")
    s, r = api("DELETE", f"/v9/projects/{ALJIBE_PROJECT}/domains/{domain}")
    if s in (200, 204):
        print(f"   ✅ Removido HTTP {s}")
    elif s == 404:
        print(f"   ℹ️  No estaba HTTP {s}")
    else:
        print(f"   ⚠️  HTTP {s}: {json.dumps(r)[:200]}")
    time.sleep(1)

# 2) Agregar dominios al project akuosplash
# Akuosplash.cl primero (apex), después www con redirect
print(f"\n==> Agregando akuosplash.cl al project akuosplash")
s, r = api("POST", f"/v10/projects/{NEW_PROJECT_ID}/domains", body={"name": "akuosplash.cl"})
print(f"   HTTP {s}: {json.dumps(r)[:300]}")
time.sleep(2)

print(f"\n==> Agregando www.akuosplash.cl (redirect a akuosplash.cl)")
s, r = api("POST", f"/v10/projects/{NEW_PROJECT_ID}/domains", body={
    "name": "www.akuosplash.cl",
    "redirect": "akuosplash.cl",
})
print(f"   HTTP {s}: {json.dumps(r)[:300]}")
time.sleep(2)

# 3) Estado final
print(f"\n==> Estado final del project akuosplash")
s, r = api("GET", f"/v9/projects/{NEW_PROJECT_ID}/domains")
if s == 200:
    domains = r.get("domains", [])
    print(f"   Total: {len(domains)}")
    for d in domains:
        print(f"   - {d.get('name')} (verified={d.get('verified')}, redirect={d.get('redirect')})")

print(f"\n==> Estado final del project AljibeApp")
s, r = api("GET", f"/v9/projects/{ALJIBE_PROJECT}/domains")
if s == 200:
    domains = r.get("domains", [])
    print(f"   Total: {len(domains)}")
    for d in domains:
        print(f"   - {d.get('name')} (verified={d.get('verified')}, redirect={d.get('redirect')})")
