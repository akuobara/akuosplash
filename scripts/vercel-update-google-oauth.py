#!/usr/bin/env python3
"""Update Google OAuth client ID + secret in Vercel project akuosplash."""
import json
import urllib.request
import urllib.error

TOKEN = "vcp_5ZuPxXyCeXeFzCQpLwfjb5xKUPUxNYI7vXMyvVLvSdjUZmXr6X2NjHS0"
TEAM = "team_BcC6nLGDaPF8NFDXQ6q97JsX"
PROJECT_ID = "prj_vVnmGI87GQM4wBszNZq8tw7kdPRo"

NEW_CLIENT_ID = "967933872287-ombtspjm385h4thmo5rnc2m10djpmf2u.apps.googleusercontent.com"
NEW_CLIENT_SECRET = "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"

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

# Get current envs
status, resp = api("GET", f"/v9/projects/{PROJECT_ID}/env")
envs = resp.get("envs", [])

for key, value in [
    ("AKUO_GOOGLE_CLIENT_ID", NEW_CLIENT_ID),
    ("AKUO_GOOGLE_CLIENT_SECRET", NEW_CLIENT_SECRET),
]:
    env_id = None
    for e in envs:
        if e.get("key") == key:
            env_id = e.get("id")
            break
    if env_id:
        body = {"value": value, "type": "encrypted", "target": ["production", "preview", "development"]}
        s, r = api("PATCH", f"/v10/projects/{PROJECT_ID}/env/{env_id}", body=body)
        print(f"✅ {key} actualizada HTTP {s}")
    else:
        body = {"key": key, "value": value, "type": "encrypted", "target": ["production", "preview", "development"]}
        s, r = api("POST", f"/v10/projects/{PROJECT_ID}/env", body=body)
        print(f"✅ {key} creada HTTP {s}")
