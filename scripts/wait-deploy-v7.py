#!/usr/bin/env python3
"""Poll newest deploy until READY, then smoke test."""
import subprocess, json, time

TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"

def list_deploys(limit=3):
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                       f"https://api.vercel.com/v6/deployments?projectId={PROJECT_ID}&limit={limit}"],
                      capture_output=True, text=True)
    d = json.loads(r.stdout) if r.stdout else {}
    return d.get("deployments", [])

def get_deploy(did):
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                       f"https://api.vercel.com/v13/deployments/{did}"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

# Tomar el deploy más nuevo
deps = list_deploys(3)
if not deps:
    print("No deployments found")
    raise SystemExit(1)
newest = deps[0]
deploy_id = newest.get("uid")
print(f"Watching newest deploy: {deploy_id} (state: {newest.get('state')})", flush=True)

start = time.time()
last = newest.get("readyState")
while time.time() - start < 900:
    d = get_deploy(deploy_id)
    s = d.get("readyState") or d.get("state") or "?"
    if s != last:
        print(f"[{int(time.time()-start)}s] state={s} url={d.get('url')}", flush=True)
        last = s
    if s in ("READY", "ERROR", "CANCELED"):
        if d.get("errorMessage"):
            print(f"FAILED: {d['errorMessage']}", flush=True)
        break
    time.sleep(20)

# Smoke test producción
print("\n=== SMOKE TEST (akuosplash.cl) ===", flush=True)
for path in ["/api/akuosplash/planes", "/akuosplash/quiero-repartir", "/akuosplash", "/akuosplash/transportista"]:
    r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
                       "--max-time", "20", f"https://akuosplash.cl{path}"],
                      capture_output=True, text=True)
    print(f"  {r.stdout.strip():4s}  https://akuosplash.cl{path}", flush=True)

# Test API response
print("\n=== API /api/akuosplash/planes ===", flush=True)
r = subprocess.run(["curl", "-sS", "--max-time", "15", "https://akuosplash.cl/api/akuosplash/planes"],
                  capture_output=True, text=True)
try:
    d = json.loads(r.stdout)
    for p in d.get("planes", []):
        print(f"  {p.get('id'):8s} | ${p.get('precioMensual'):>6} | {p.get('comisionPct')}% comisión | {p.get('maxVehiculos')}v/{p.get('maxChoferes')}c", flush=True)
    print(f"  feeManual: ${d.get('feeManual', {}).get('fijo')} + {d.get('feeManual', {}).get('pct')}%", flush=True)
    print(f"  mpSandbox: {d.get('mpSandbox')}", flush=True)
except Exception as e:
    print(f"  ERROR parsing: {e}", flush=True)
    print(f"  raw: {r.stdout[:500]}", flush=True)

# Verify no plan-based payout timing
print("\n=== Verificar contenido (sin 'Pago a X días' / 'Pago instantáneo') ===", flush=True)
r = subprocess.run(["curl", "-sS", "--max-time", "15", "https://akuosplash.cl/akuosplash/quiero-repartir"],
                  capture_output=True, text=True)
html = r.stdout
for kw in ["Pago decidido en tu cuenta MP", "no depende del plan"]:
    found = "✓" if kw in html else "✗"
    print(f"  {found}  {kw}", flush=True)
for kw in ["Pago instantáneo", "Pago a 10 días", "en plan Gratis a 10", "en Premium y Pro de forma"]:
    found = "PRESENTA (✗)" if kw in html else "AUSENTE (✓ correcto)"
    print(f"  {found}  '{kw}'", flush=True)
