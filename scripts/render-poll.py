import json, time, urllib.request, urllib.error

RENDER_KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"
SERVICE_ID = "srv-dbh705uc6qcc73fqd620"
H = {"Authorization": f"Bearer {RENDER_KEY}", "Accept": "application/json"}

def render(method, path):
    req = urllib.request.Request(f"https://api.render.com/v1/{path}", method=method, headers=H)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]

# Listar últimos deploys
st, r = render("GET", f"services/{SERVICE_ID}/deploys?limit=3")
print(f"HTTP {st}")
deps = r if isinstance(r, list) else r.get("deploys", [])
if not deps and isinstance(r, dict):
    deps = [r]
for d in deps[:3]:
    print(f"  deploy {d.get('id')[:12]}  status={d.get('status')}  commit={d.get('commit',{}).get('id','?')[:8] if isinstance(d.get('commit'),dict) else str(d.get('commit'))[:8]}  updatedAt={d.get('updatedAt','?')[:19]}")

# Poll el más reciente hasta live/failed
if deps:
    did = deps[0].get("id")
    print(f"\n→ Polleando deploy {did[:12]}...")
    start = time.time(); last = None
    while time.time() - start < 300:
        st, r = render("GET", f"services/{SERVICE_ID}/deploys/{did}")
        d = r.get("deploy", r) if isinstance(r, dict) else r
        s = d.get("status")
        if s != last:
            print(f"  [{int(time.time()-start)}s] status={s}")
            last = s
        if s in ("live", "build_failed", "update_failed", "canceled", "deactivated"):
            print(f"\n=== FINAL: {s} (a los {int(time.time()-start)}s) ===")
            break
        time.sleep(10)
    else:
        print(f"TIMEOUT — último status: {last}")
