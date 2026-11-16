#!/usr/bin/env python3
"""Dispara un deploy manual en Render para el servicio akuosplash
(desde el último commit de main = 96c80b9, que tiene el botón Informe)
y polluea hasta que esté live o falle."""
import json, time, urllib.request, urllib.error

RENDER_KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"
SERVICE_ID = "srv-dbh705uc6qcc73fqd620"
H = {"Authorization": f"Bearer {RENDER_KEY}", "Accept": "application/json", "Content-Type": "application/json"}

def render(method, path, body=None):
    url = f"https://api.render.com/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=H)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

# 1) disparar deploy
print("→ Disparando deploy en Render (service akuosplash)...")
st, resp = render("POST", f"services/{SERVICE_ID}/deploys", {})
if st not in (200, 201):
    print(f"ERROR HTTP {st}: {resp}")
    raise SystemExit(1)
deploy = resp.get("deploy", resp) if isinstance(resp, dict) else resp
did = deploy.get("id")
print(f"  deploy id: {did}")
print(f"  commit: {deploy.get('commit')}")

# 2) polluear hasta live / failed
print("\n→ Esperando build (los deploys previos tardaron ~3 min)...")
start = time.time()
last = None
while time.time() - start < 420:  # 7 min max
    st, r = render("GET", f"services/{SERVICE_ID}/deploys/{did}")
    d = r.get("deploy", r) if isinstance(r, dict) else r
    status = d.get("status")
    if status != last:
        print(f"  [{int(time.time()-start)}s] status={status}")
        last = status
    if status in ("live", "build_failed", "update_failed", "canceled", "deactivated"):
        print(f"\n=== FINAL: {status} (a los {int(time.time()-start)}s) ===")
        if status == "live":
            print(f"  startedAt={d.get('startedAt')}  finishedAt={d.get('finishedAt')}")
        else:
            print(f"  raw: {json.dumps(d)[:600]}")
        break
    time.sleep(10)
else:
    print(f"TIMEOUT — último status: {last}")
