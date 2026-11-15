#!/usr/bin/env python3
"""Check commit statuses + check-runs en akuobara/akuosplash para ver si
Vercel (u otro) agarró los pushes recientes. Usa el PAT del remote (sin imprimirlo)."""
import json, re, subprocess, urllib.request, urllib.error

remotes = subprocess.run(["git","remote","get-url","akuosplash"],
    capture_output=True, text=True).stdout
m = re.search(r"://([^:]+):([^@]+)@", remotes)
PAT = m.group(2) if m else ""

def gh(path):
    req = urllib.request.Request(f"https://api.github.com/{path}",
        headers={"Authorization": f"token {PAT}", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_status": e.code, "_body": e.read().decode()[:300]}

for sha in ["96c80b9", "153e247"]:
    print(f"\n=== {sha} en akuobara/akuosplash ===")
    # statuses (services como Vercel viejo)
    s = gh(f"repos/akuobara/akuosplash/commits/{sha}/status")
    if isinstance(s, dict) and s.get("statuses"):
        print(f"  combined: {s.get('state')}")
        for st in s["statuses"][:6]:
            print(f"    - {st.get('context','')[:45]:45} {st.get('state','')}  {st.get('target_url','')[:55]}")
    else:
        print(f"  statuses: {s if '_status' in s else 'ninguno'}")
    # check-runs (GitHub Actions / Vercel nuevo)
    c = gh(f"repos/akuobara/akuosplash/commits/{sha}/check-runs")
    if isinstance(c, dict) and c.get("check_runs"):
        print(f"  check-runs: {len(c['check_runs'])}")
        for cr in c["check_runs"][:6]:
            print(f"    - {cr.get('name','')[:45]:45} {cr.get('conclusion') or cr.get('status','')}  {cr.get('html_url','')[:55]}")
    else:
        print(f"  check-runs: {c if '_status' in c else 'ninguno'}")

# installations de GitHub Apps en el repo (para ver si Vercel app está instalada)
print("\n=== GitHub Apps instaladas en akuobara/akuosplash ===")
inst = gh("repos/akuobara/akuosplash/installation")
print(f"  {inst if '_status' in inst else 'app installation: ' + str(inst.get('id'))}")
