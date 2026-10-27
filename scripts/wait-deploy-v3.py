#!/usr/bin/env python3
"""Wait for dpl_ETdWZ1ynH1yYRWcTT8iY6 + smoke test."""
import subprocess, json, time

TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
DEPLOY_ID = "dpl_ETdWZ1ynH1yYRWcTT8iY6"

def get():
    r = subprocess.run(["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
                       f"https://api.vercel.com/v13/deployments/{DEPLOY_ID}"],
                      capture_output=True, text=True)
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last = None
while time.time() - start < 900:  # 15 min
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

# Smoke test on production alias (akuosplash.cl / akuosplash.vercel.app)
print("\n=== SMOKE TEST (production alias akuosplash.cl) ===", flush=True)
tests = [
    "/akuosplash/quiero-repartir",
    "/akuosplash",
    "/akuosplash/transportista",
    "/api/akuosplash/auth/me",
]
for path in tests:
    r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
                       "--max-time", "20", f"https://akuosplash.cl{path}"],
                      capture_output=True, text=True)
    print(f"  {r.stdout.strip():4s}  https://akuosplash.cl{path}", flush=True)

print("\n=== Contenido de la landing v3 ===", flush=True)
r = subprocess.run(["curl", "-sS", "--max-time", "20",
                   "https://akuosplash.cl/akuosplash/quiero-repartir"],
                  capture_output=True, text=True)
html = r.stdout
keywords = [
    "El panel completo para tu negocio de reparto",
    "11 herramientas",
    "Las herramientas que conseguís",
    "+ Marketplace de AkuoSplash",
    "Próximamente",
    "MercadoPago Split",
    "$3.290",
    "17.5%",
    "12.5%",
    "8.5%",
    "7.990",
    "23.990",
    "Herramientas incluidas",
    "Fee por retiro manual",
    "Dashboard",
    "Entregas y vueltas",
    "Camiones (gestión)",
    "Liquidación",
    "Equipo (choferes)",
]
for kw in keywords:
    found = "✓" if kw in html else "✗"
    print(f"  {found}  {kw}", flush=True)
