#!/usr/bin/env python3
"""Poll deploy dpl_EkTAb6q9LRzh6iTDV1J3LNifdaiS and smoke test when READY."""
import subprocess, json, time, sys

TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
DEPLOY_ID = "dpl_EkTAb6q9LRzh6iTDV1J3LNifdaiS"

def get_deploy():
    r = subprocess.run(
        ["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
         f"https://api.vercel.com/v13/deployments/{DEPLOY_ID}"],
        capture_output=True, text=True
    )
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last_state = None
while time.time() - start < 600:  # 10 min polling
    d = get_deploy()
    state = d.get("readyState") or d.get("state") or "?"
    url = d.get("url")
    err = d.get("errorMessage")
    if state != last_state:
        elapsed = int(time.time() - start)
        print(f"[{elapsed}s] state={state} url={url}", flush=True)
        last_state = state
    if state in ("READY", "ERROR", "CANCELED"):
        if err: print(f"FAILED: {err}", flush=True)
        print(f"\nFINAL: state={state} url={url}", flush=True)
        break
    time.sleep(15)
else:
    print("Timeout 10min. Estado actual:", last_state, flush=True)

if last_state == "READY":
    print("\n=== SMOKE TEST ===", flush=True)
    base = f"https://{url}" if url and not url.startswith("http") else url
    tests = ["/akuosplash/quiero-repartir", "/akuosplash", "/akuosplash/transportista", "/api/akuosplash/auth/me"]
    for path in tests:
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", base + path],
                          capture_output=True, text=True)
        print(f"  {r.stdout.strip():4s}  {base}{path}", flush=True)
    print("\n=== Contenido de la landing nueva ===", flush=True)
    r = subprocess.run(["curl", "-sS", base + "/akuosplash/quiero-repartir"], capture_output=True, text=True)
    import re
    for kw in ["El panel completo para tu negocio de reparto", "11 herramientas", "Las herramientas que conseguís", "+ Marketplace de AkuoSplash", "Pestaña Pedidos", "Dashboard", "Entregas", "Gastos", "Liquidación", "Recurrentes", "Historial"]:
        found = "+" if kw in r.stdout else "✗"
        print(f"  {found}  {kw}", flush=True)
