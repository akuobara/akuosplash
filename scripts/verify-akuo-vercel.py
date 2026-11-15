#!/usr/bin/env python3
"""Verifica el proyecto akuosplash en Vercel con el token vcp_ y saca team + dominios."""
import json, urllib.request, urllib.error

TOKEN = "vcp_1DsytMvMt4VEeLfOcl5cOsJS56N8rjkdRNHp45tCZbuoG7DMTR43SiAW"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"

def vercel(path):
    req = urllib.request.Request(f"https://api.vercel.com/{path}",
        headers={"Authorization": f"Bearer {TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {"_status": e.code, "_body": e.read().decode()[:400]}

# 1) info del proyecto (probar sin team y con team conocido)
p = vercel(f"v9/projects/{PROJECT_ID}")
if "_status" in p:
    # probar con el team de deploy-vercel-direct
    p = vercel(f"v9/projects/{PROJECT_ID}?teamId=team_BcC6nLGDaPF8NFDXQ6q97JsX")

if "_status" in p:
    print(f"ERROR {p['_status']}: {p['_body']}")
else:
    proj = p
    print(f"name: {proj.get('name')}")
    print(f"team/org: {json.dumps(proj.get('teamId') or proj.get('ownerId'))}")
    targets = proj.get('targets',{}) or {}
    prod = targets.get('production',{}) or {}
    print(f"production node version: {prod.get('nodeVersion')}")
    print(f"build command: {prod.get('buildCommand')}")
    print(f"output dir: {prod.get('outputDirectory')}")
    print(f"install command: {prod.get('installCommand')}")
    print(f"framework: {proj.get('framework')}")
    aliases = proj.get('alias',[]) or []
    print(f"aliases: {aliases}")
    # últimos deployments
    d = vercel(f"v6/deployments?projectId={PROJECT_ID}&limit=4&teamId=team_BcC6nLGDaPF8NFDXQ6q97JsX")
    deps = d.get('deployments',[]) if isinstance(d,dict) else []
    print(f"\núltimos {len(deps)} deploys:")
    for dep in deps:
        meta = dep.get('meta',{}) or {}
        print(f"  {dep.get('created','')[:19]}  {dep.get('readyState','?'):8}  target={dep.get('target','?')}  {(meta.get('commitSha') or '')[:7]}  {(meta.get('commitMessage') or '')[:45]}  url={dep.get('url','')}")
