#!/usr/bin/env python3
"""Poll deploy dpl_J6cjqx5LQZix66Tx2CRTY until READY/ERROR, then smoke test."""
import subprocess, json, time

TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
DEPLOY_ID = "dpl_J6cjqx5LQZix66Tx2CRTY"

def get():
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                       f"https://api.vercel.com/v13/deployments/{DEPLOY_ID}"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last = None
while time.time() - start < 900:
    d = get()
    s = d.get("readyState") or d.get("state") or "?"
    if s != last:
        print(f"[{int(time.time()-start)}s] state={s} url={d.get('url')}", flush=True)
        last = s
    if s in ("READY", "ERROR", "CANCELED"):
        if d.get("errorMessage"):
            print(f"FAILED: {d['errorMessage']}", flush=True)
        break
    time.sleep(20)

print("\n=== SMOKE TEST (akuosplash.cl) ===", flush=True)
for path in ["/akuosplash/quiero-repartir", "/akuosplash", "/akuosplash/transportista", "/api/akuosplash/auth/me"]:
    r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
                       "--max-time", "20", f"https://akuosplash.cl{path}"],
                      capture_output=True, text=True)
    print(f"  {r.stdout.strip():4s}  https://akuosplash.cl{path}", flush=True)

print("\n=== Contenido v4 ===", flush=True)
r = subprocess.run(["curl", "-sS", "--max-time", "20", "https://akuosplash.cl/akuosplash/quiero-repartir"],
                  capture_output=True, text=True)
html = r.stdout
keywords = [
    "MercadoPago Split*",
    "módulo del marketplace",
    "Módulo Marketplace (próximamente)",
    "Historial de entregas",
    "AkuoSplash no es una herramienta contable",
    "reporta al SII ningún movimiento",
    "Solo si conectás tu cuenta",
    "Entregas (historial)",
    "Pedidos (clientes propios)",
    "Fee por retiro manual*",
    "próximamente (con marketplace)",
]
for kw in keywords:
    found = "✓" if kw in html else "✗"
    print(f"  {found}  {kw}", flush=True)
