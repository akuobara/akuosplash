#!/usr/bin/env python3
"""Add custom domain akuosplash.cl + www.akuosplash.cl to Vercel project."""
import json
import urllib.request
import urllib.error

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"
DOMAIN = "akuosplash.cl"
WWW_DOMAIN = "www.akuosplash.cl"

BASE = "https://api.vercel.com"

def api(method, path, body=None):
    url = f"{BASE}{path}"
    if "?teamId=" not in url:
        url = f"{url}?teamId={TEAM}"
    h = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# Add akuosplash.cl (apex)
print(f"==> Agregando dominio {DOMAIN}")
s, r = api("POST", f"/v10/projects/{PROJECT_ID}/domains", body={
    "name": DOMAIN,
    "gitBranch": None,
})
print(f"   HTTP {s}: {json.dumps(r)[:300]}")

# Add www.akuosplash.cl with redirect to apex
print(f"==> Agregando {WWW_DOMAIN} (redirect a {DOMAIN})")
s, r = api("POST", f"/v10/projects/{PROJECT_ID}/domains", body={
    "name": WWW_DOMAIN,
    "gitBranch": None,
    "redirect": DOMAIN,
})
print(f"   HTTP {s}: {json.dumps(r)[:300]}")

# Get project domains with verification info
print(f"\n==> Estado actual de dominios del project")
s, r = api("GET", f"/v9/projects/{PROJECT_ID}/domains")
if s == 200:
    domains = r.get("domains", [])
    print(f"   Total: {len(domains)}")
    for d in domains:
        print(f"\n   --- {d.get('name')} ---")
        print(f"   verified: {d.get('verified')}")
        print(f"   verification: {d.get('verification')}")
        records = d.get('verification', {}) or {}
        if records:
            for v in records if isinstance(records, list) else [records]:
                print(f"     type={v.get('type')}, name={v.get('domain') or v.get('name')}, value={v.get('value', '')[:60]}")
        intended = d.get("intendedData", {})
        if intended:
            print(f"   intended DNS records:")
            if isinstance(intended, dict) and intended.get("records"):
                for rec in intended.get("records", []):
                    print(f"     {rec.get('type')} {rec.get('name')} -> {rec.get('value')}")
