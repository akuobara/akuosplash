"""Set GitHub Actions secrets encrypted with the repo's public key."""
import base64
import json
import sys
from urllib.request import Request, urlopen
from nacl import encoding, public

GH_TOKEN = "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"
REPO = "akuobara/akuosplash"

SECRETS = {
    "CLOUDFLARE_API_TOKEN": "cfut_8CjLnfA7cDyDvx844zQzg76mEunFrBIQaETyAcpV2c659dc0",
    "CLOUDFLARE_ACCOUNT_ID": "e52792b0c5a1a025f63775d4103b8928",
    "DATABASE_URL": "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io",
    "DATABASE_AUTH_TOKEN": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA",
    "AKUOSPLASH_JWT_SECRET": "akuosplash-jwt-secret-prod-2026-secure-random-x9k2m",
    "NEXT_PUBLIC_APP_URL": "https://akuosplash.pages.dev",
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY": "AIzaSyBuZ4DbUyF2lmX-0tmcdoiptbwodKZJxFM",
}

def api(method, path, body=None):
    url = f"https://api.github.com/repos/{REPO}/{path}"
    headers = {
        "Authorization": f"token {GH_TOKEN}",
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req) as r:
            body_text = r.read().decode()
            status = r.status
            return status, json.loads(body_text) if body_text else {}
    except Exception as e:
        return getattr(e, "code", 0), {"error": str(e)}

# 1. Get repo public key
print("=== Fetching repo public key ===")
status, key_resp = api("GET", "actions/secrets/public-key")
if status != 200:
    print(f"Failed: {status} {key_resp}")
    sys.exit(1)
pk_obj = public.PublicKey(key_resp["key"].encode(), encoding.Base64Encoder())
sealed = public.SealedBox(pk_obj)
key_id = key_resp["key_id"]
print(f"  key_id: {key_id}")

# 2. Encrypt + set each secret
print("\n=== Setting secrets ===")
for name, value in SECRETS.items():
    encrypted = sealed.encrypt(value.encode())
    body = {"encrypted_value": base64.b64encode(encrypted).decode(), "key_id": key_id}
    status, resp = api("PUT", f"actions/secrets/{name}", body)
    if status in (201, 204):
        print(f"  ✓ {name}")
    else:
        print(f"  ✗ {name}: {status} {resp}")

print("\nDone.")
