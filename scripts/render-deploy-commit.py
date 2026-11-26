#!/usr/bin/env python3
"""Dispara un deploy en Render con un commitId explícito (Render no auto-sincroniza
el push, así que hay que forzar el commit). Polluea hasta live/fail.
Uso: python3 scripts/render-deploy-commit.py <commit-hash>"""
import json, sys, time, urllib.request, urllib.error

RENDER_KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"
SERVICE_ID = "srv-dbh705uc6qcc73fqd620"
H = {"Authorization": f"Bearer {RENDER_KEY}", "Accept": "application/json", "Content-Type": "application/json"}

commit = sys.argv[1] if len(sys.argv) > 1 else None
if not commit:
    print("uso: render-deploy-commit.py <commit-hash>"); raise SystemExit(1)

def render(method, path, body=None):
    url = f"https://api.render.com/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=H)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]

print(f"→ Deploy explícito commit {commit[:10]}...")
st, resp = render("POST", f"services/{SERVICE_ID}/deploys", {"commitId": commit})
if st not in (200, 201):
    print(f"ERROR HTTP {st}: {resp}"); raise SystemExit(1)
deploy = resp.get("deploy", resp) if isinstance(resp, dict) else resp
did = deploy.get("id")
print(f"  deploy id: {did}  commit: {deploy.get('commit', {}).get('id', '?')[:10] if isinstance(deploy.get('commit'), dict) else '?'}")

print("\n→ Esperando build...")
start = time.time(); last = None
while time.time() - start < 420:
    st, r = render("GET", f"services/{SERVICE_ID}/deploys/{did}")
    d = r.get("deploy", r) if isinstance(r, dict) else r
    status = d.get("status")
    if status != last:
        print(f"  [{int(time.time()-start)}s] status={status}"); last = status
    if status in ("live", "build_failed", "update_failed", "canceled", "deactivated"):
        print(f"\n=== FINAL: {status} (a los {int(time.time()-start)}s) ===")
        break
    time.sleep(10)
else:
    print(f"TIMEOUT — último status: {last}")
