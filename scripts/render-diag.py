#!/usr/bin/env python3
"""Diagnostica el servicio akuosplash en Render: estado, últimos deploys,
y dispara un deploy nuevo si el último no tiene mi commit."""
import json, urllib.request, urllib.error

RENDER_KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"
H = {"Authorization": f"Bearer {RENDER_KEY}", "Accept": "application/json"}

def render(method, path, body=None):
    url = f"https://api.render.com/v1/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers={**H, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]

# 1) listar servicios → encontrar akuosplash
st, resp = render("GET", "services")
if st != 200 or not isinstance(resp, list):
    print(f"listar servicios: HTTP {st} — {resp if not isinstance(resp,list) else ''}")
    raise SystemExit(1)
services = [item.get("service", item) for item in resp]  # unwrap {cursor, service}
print(f"=== {len(services)} servicios ===")
for s in services:
    print(f"  id={s.get('id')}  name={s.get('name')!r}  repo={s.get('repo','')}")
svc = next((s for s in services if s.get("name") == "akuosplash"), None)
if not svc:
    svc = next((s for s in services if "akuosplash" in str(s.get("repo","")) or "akuosplash" in str(s.get("name",""))), None)
if not svc:
    print("no hallé akuosplash por name ni repo")
    raise SystemExit(1)

sid = svc["id"]
print(f"=== servicio akuosplash ===")
print(f"  id: {sid}")
print(f"  repo: {svc.get('repo')}")
print(f"  branch: {svc.get('branch')}")
print(f"  autoDeploy: {svc.get('autoDeploy')}")
print(f"  status: {svc.get('status')}")
print(f"  suspended: {svc.get('suspended')}")
ds = svc.get('serviceDetails',{})
print(f"  buildCommand: {ds.get('buildCommand')}")
print(f"  startCommand: {ds.get('startCommand')}")

# 2) últimos deploys
st, resp = render("GET", f"services/{sid}/deploys?limit=8")
print(f"\n=== últimos deploys (HTTP {st}) ===")
deps = [item.get("deploy", item) for item in resp] if isinstance(resp, list) else []
if deps:
    print(f"  raw keys del primer deploy: {list(deps[0].keys())}")
    for d in deps:
        commit = d.get("commit")
        csha = (commit.get("id","")[:7]) if isinstance(commit, dict) else ""
        cmsg = (commit.get("message","")[:48]) if isinstance(commit, dict) else ""
        print(f"  {d.get('createdAt','')[:19]}  status={d.get('status','?')}  finish={d.get('finishedAt','')[:19]}  {csha}  {cmsg}")
else:
    print(f"  resp: {str(resp)[:400]}")
    # chequeo directo del endpoint live
    print(f"\n  (si no hay deploys listados, el servicio puede estar idle sin deploys recientes)")
