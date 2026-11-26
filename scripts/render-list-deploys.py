#!/usr/bin/env python3
"""Lista los últimos deploys de Render con su commit + status."""
import json, urllib.request
KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"
SID = "srv-dbh705uc6qcc73fqd620"
req = urllib.request.Request(
    f"https://api.render.com/v1/services/{SID}/deploys?limit=12",
    headers={"Authorization": f"Bearer {KEY}", "Accept": "application/json"},
)
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.loads(r.read())
for item in data:
    x = item.get("deploy", item)
    c = x.get("commit") or {}
    cid = c.get("id", "?")[:10] if isinstance(c, dict) else str(c)[:10]
    msg = c.get("message", "")[:42] if isinstance(c, dict) else ""
    st = str(x.get("status") or "?")
    ca = str(x.get("createdAt") or "?")[:19]
    print(f"  {ca}  {st:18}  {cid}  {msg}")
