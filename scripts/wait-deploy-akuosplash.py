#!/usr/bin/env python3
"""Espera a que termine el deploy dpl_9m9kTz y reporta el resultado + URL."""
import subprocess, json, time, sys

TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"
DEPLOY_ID = "dpl_9m9kTz"

def get_deploy():
    r = subprocess.run(
        ["curl", "-sS", "-H", f"Authorization: Bearer {TOKEN}",
         f"https://api.vercel.com/v13/deployments/{DEPLOY_ID}"],
        capture_output=True, text=True
    )
    return json.loads(r.stdout) if r.stdout else {}

start = time.time()
last_state = None
while True:
    d = get_deploy()
    state = d.get("state") or d.get("readyState") or "?"
    ready = d.get("ready")
    url = d.get("url")
    alias = d.get("alias", [])
    err = d.get("errorMessage")
    
    if state != last_state:
        elapsed = int(time.time() - start)
        print(f"[{elapsed}s] state={state} ready={ready} url={url} alias={alias[:3]}", flush=True)
        last_state = state
    
    if state in ("READY", "ERROR", "CANCELED"):
        if err:
            print(f"\nFAILED: {err}", flush=True)
        print(f"\nFINAL: state={state} url={url}", flush=True)
        if url:
            print(f"  → https://{url}/akuosplash/quiero-repartir", flush=True)
        break
    time.sleep(10)

# Smoke test
if url:
    print("\n=== SMOKE TEST ===", flush=True)
    base = f"https://{url}" if url.startswith("akuosplash") else url
    tests = ["/", "/akuosplash", "/akuosplash/quiero-repartir", "/akuosplash/transportista", "/api/akuosplash/auth/me"]
    for path in tests:
        r = subprocess.run(["curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}", base + path],
                          capture_output=True, text=True)
        print(f"  {r.stdout.strip():4s}  {base}{path}", flush=True)
