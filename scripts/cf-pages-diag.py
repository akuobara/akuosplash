#!/usr/bin/env python3
"""Diagnóstico del proyecto akuosplash en Cloudflare Pages.
Lee el token de wait-cf-deploy-v2.py sin imprimirlo."""
import json, re, subprocess, sys

# extraer token/account/project del script wait (sin imprimir el token)
src = open("/home/z/my-project/scripts/wait-cf-deploy-v2.py").read()
def grab(pat):
    m = re.search(pat, src)
    return m.group(1) if m else None
TOKEN = grab(r'TOKEN\s*=\s*"([^"]+)"')
ACCOUNT_ID = grab(r'ACCOUNT_ID\s*=\s*"([^"]+)"')
PROJECT = grab(r'PROJECT\s*=\s*"([^"]+)"')
if not all([TOKEN, ACCOUNT_ID, PROJECT]):
    print("No pude extraer token/account/project"); sys.exit(1)
print(f"project={PROJECT}  account={ACCOUNT_ID[:8]}...  token=<{len(TOKEN)} chars>")

def cf(path):
    r = subprocess.run(["curl","-sS","-H",f"Authorization: Bearer {TOKEN}",
        f"https://api.cloudflare.com/client/v4/{path}"],
        capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except: return {"raw": r.stdout[:500]}

# 1) info del proyecto: build command, source, production branch
p = cf(f"accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}")
if not isinstance(p, dict) or not p.get("success", True):
    print("\n=== PROJECT CONFIG (raw, token sin permiso?) ===")
    print(json.dumps(p, indent=2)[:800] if isinstance(p,dict) else str(p)[:800])
    proj = {}
else:
    proj = p.get("result") or {}
    bc = proj.get("build_config") or {}
    src = proj.get("source") or {}
    ds = (proj.get("deployment_configs") or {}).get("production") or {}
    print("\n=== PROJECT CONFIG ===")
    print(f"  production_branch: {proj.get('production_branch')}")
    print(f"  build_command:     {bc.get('build_command')}")
    print(f"  destination_dir:   {bc.get('destination_dir')}")
    print(f"  root_dir:          {bc.get('root_dir')}")
    print(f"  source/repo:       {src.get('owner')}/{src.get('repo_name')} branch={src.get('production_branch')}")
    print(f"  deployments_enabled: {src.get('deployments_enabled')}")
    print(f"  env vars (keys):   {sorted(list((ds.get('env_vars') or {}).keys()))[:15]}")

# 2) deployments recientes
d = cf(f"accounts/{ACCOUNT_ID}/pages/projects/{PROJECT}/deployments?per_page=8")
deps = d.get("result",[]) if isinstance(d,dict) else []
print(f"\n=== ÚLTIMOS {len(deps)} DEPLOYS ===")
for dep in deps:
    short = dep.get('short_id','')[:8]
    stages = dep.get('stages',[])
    last = stages[-1] if stages else {}
    meta = dep.get('deployment_trigger',{}).get('metadata',{}) or {}
    sha = (meta.get('commit_sha') or '')[:7]
    msg = (meta.get('commit_message') or '')[:50]
    branch = meta.get('branch','')
    env = dep.get('environment','')
    print(f"  {dep.get('created_on','')[:19]}  {env:10}  {short}  stage={last.get('name')} status={last.get('status')}  {branch} {sha} {msg}")
