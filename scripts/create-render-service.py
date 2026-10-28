#!/usr/bin/env python3
"""Crea el Web Service de Render via API con serviceDetails correcto."""
import json
import urllib.request
import urllib.error

RENDER_KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"

service_body = {
    "type": "web_service",
    "name": "akuosplash",
    "ownerId": "tea-dbh5t9ui0phs73aip87g",
    "repo": "https://github.com/akuobara/akuosplash",
    "branch": "main",
    "autoDeploy": "yes",
    "serviceDetails": {
        "runtime": "node",
        "envSpecificDetails": {
            "plan": "free",
            "region": "oregon",
            "runtime": "node",
            "buildCommand": "npm install --legacy-peer-deps --no-audit --no-fund && npm run build",
            "startCommand": "npm run start",
            "healthCheckPath": "/akuosplash",
            "envVars": [
                {"key": "DATABASE_URL", "value": "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io"},
                {"key": "DATABASE_AUTH_TOKEN", "value": "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODQwNTY2MDYsImlkIjoiMDE5ZjYyMDgtYmIwMS03Y2Q0LWExMzUtNWYyOTJiM2MwZjg4Iiwia2lkIjoiUHRTTWZrMHlMQ0FFQTRXMGNmR3c4a05aRVZHOFN6bVoteW1NWlNhc1JUMCIsInJpZCI6IjgwZmE1NWRjLWUwMTEtNDVmNy05YzRjLWI5NWFiYjliYmJjYSJ9.yHT5N2_3FtRrePwdPq5iXnNHjiLyCbPuway0D0NAELkxgxH8pW3kT1w821i4ufto2Q0rKiHiRHG5NdsexHxYDA"},
                {"key": "AKUOSPLASH_JWT_SECRET", "value": "akuosplash-jwt-secret-prod-2026-secure-random-x9k2m"},
                {"key": "AKUO_FACEBOOK_APP_ID", "value": "2095394961067992"},
                {"key": "AKUO_FACEBOOK_APP_SECRET", "value": "5c3e50ecf3087d4f498a8bee1e853055"},
                {"key": "AKUO_GOOGLE_CLIENT_ID", "value": "109876197648-nkqitom82d4gqmu4ramisb2n5v7ejcg1.apps.googleusercontent.com"},
                {"key": "AKUO_GOOGLE_CLIENT_SECRET", "value": "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"},
                {"key": "AKUO_MP_ACCESS_TOKEN", "value": "APP_USR-2731961034891399-100523-9a2ea0da114449c3d67fe3255fffdce3-3738974993"},
                {"key": "AKUO_MP_CLIENT_ID", "value": "2731961034891399"},
                {"key": "AKUO_MP_PUBLIC_KEY", "value": "APP_USR-01c8fba9-52cb-4fc9-92f3-0ee8cbf73c0b"},
                {"key": "AKUO_MP_SANDBOX", "value": "true"},
                {"key": "AKUO_MP_USER_ID", "value": "3738974993"},
                {"key": "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "value": "AIzaSyBuZ4DbUyF2lmX-0tmcdoiptbwodKZJxFM"},
                {"key": "NEXT_PUBLIC_APP_URL", "value": "https://akuosplash.onrender.com"},
                {"key": "AKUOSPLASH_DATABASE_URL", "value": "libsql://aljibeapp-akuobara.aws-us-west-2.turso.io"},
                {"key": "PORT", "value": "10000"},
            ],
        },
    },
}

req = urllib.request.Request(
    "https://api.render.com/v1/services",
    data=json.dumps(service_body).encode(),
    headers={
        "Authorization": f"Bearer {RENDER_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
    method="POST",
)

print("=== Creating Web Service ===")
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"✓ Service created!")
        print(f"  id: {data.get('id')}")
        print(f"  name: {data.get('name')}")
        print(f"  status: {data.get('status')}")
        print(f"  plan: {data.get('plan')}")
        print(f"  repo: {data.get('repo', {}).get('url')}")
        print(f"  branch: {data.get('repo', {}).get('branch')}")
        print(f"  serviceDetails.url: {data.get('serviceDetails', {}).get('url')}")
        # Save id
        with open("/tmp/render-service-id.txt", "w") as f:
            f.write(data.get('id', ''))
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"✗ HTTP {e.code}: {body}")
except Exception as e:
    print(f"✗ error: {e}")
