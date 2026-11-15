#!/usr/bin/env python3
"""Usa el PAT de GitHub (del remote akuosplash) para ver si Cloudflare Pages
está conectado al repo y si las notificaciones de push llegaron.
NO imprime el PAT."""
import json, re, subprocess, sys, urllib.request, urllib.error

# extraer PAT del remote akuosplash (sin imprimirlo)
remotes = subprocess.run(["git","remote","get-url","akuosplash"],
    capture_output=True, text=True).stdout
m = re.search(r"://([^:]+):([^@]+)@", remotes)
if not m:
    print("No encontré PAT en el remote akuosplash"); sys.exit(1)
USER, PAT = m.group(1), m.group(2)
print(f"github user={USER}  pat=<{len(PAT)} chars>")

def gh(path):
    req = urllib.request.Request(f"https://api.github.com/{path}",
        headers={"Authorization": f"token {PAT}", "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_status": e.code, "_body": e.read().decode()[:300]}

# 1) webhooks del repo akuobara/akuosplash
wh = gh("repos/akuobara/akuosplash/hooks")
print("\n=== WEBHOOKS en akuobara/akuosplash ===")
hooks = wh if isinstance(wh, list) else []
if not hooks:
    print("  (ningún webhook — CF Pages NO está conectado a este repo vía Git)")
    print(f"  resp: {wh if not isinstance(wh,list) else ''}")
else:
    for h in hooks:
        print(f"  id={h.get('id')}  url={h.get('config',{}).get('url','')[:70]}")
        print(f"    events={h.get('events')}  active={h.get('active')}")
        # entregas recientes de este webhook
        deliv = gh(f"repos/akuobara/akuosplash/hooks/{h.get('id')}/deliveries?per_page=6")
        if isinstance(deliv, list):
            print(f"    últimas {len(deliv)} entregas:")
            for d in deliv:
                print(f"      {d.get('delivered_at','')[:19]}  action={d.get('action','')}  event={d.get('event')}  status={d.get('status_code')}  guid={str(d.get('guid',''))[:8]}")

# 2) también el repo aljibe-app
wh2 = gh("repos/akuobara/aljibe-app/hooks")
print("\n=== WEBHOOKS en akuobara/aljibe-app ===")
hooks2 = wh2 if isinstance(wh2, list) else []
if not hooks2:
    print("  (ningún webhook)")
else:
    for h in hooks2:
        print(f"  id={h.get('id')}  url={h.get('config',{}).get('url','')[:70]}  events={h.get('events')}  active={h.get('active')}")
