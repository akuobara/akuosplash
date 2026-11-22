#!/usr/bin/env python3
"""Crea un Render Cron Job que llama diario a /api/cron/generar-recurrentes.
vercel.json declara este cron pero la app está en Render (no Vercel), así que
nunca corría. Esto lo reemplaza con un cron job real."""
import json, urllib.request, urllib.error

KEY = "rnd_hU2AJiqQUliPGCvIl5duCr1YwfP7"
H = {"Authorization": f"Bearer {KEY}", "Accept": "application/json", "Content-Type": "application/json"}

# Verificar si ya existe un cron job con este nombre (idempotente)
def list_cron_jobs():
    req = urllib.request.Request("https://api.render.com/v1/services?limit=50&type=cron_job", headers=H)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return []

existing = list_cron_jobs()
ya_existe = any(s.get("name") == "aljibeapp-generar-recurrentes" for s in existing)
if ya_existe:
    print("✓ El cron job 'aljibeapp-generar-recurrentes' ya existe — no se crea otro.")
    raise SystemExit(0)

body = {
    "type": "cron_job",
    "name": "aljibeapp-generar-recurrentes",
    "ownerId": "tea-dbh5t9ui0phs73aip87g",
    "image": {
        "ownerId": "tea-dbh5t9ui0phs73aip87g",
        "imagePath": "curlimages/curl:8.7.1",
    },
    "serviceDetails": {
        "schedule": "0 10 * * *",  # diario 10:00 UTC = 07:00 Chile
        "runtime": "image",
        "plan": "starter",
        "region": "oregon",
        "envSpecificDetails": {
            "dockerCommand": "curl -fsS --max-time 60 https://akuosplash.cl/api/cron/generar-recurrentes"
        },
    },
}
req = urllib.request.Request(
    "https://api.render.com/v1/services",
    data=json.dumps(body).encode(),
    method="POST",
    headers=H,
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        resp = json.loads(r.read())
    print("✓ Cron job creado:")
    print("  id:", resp.get("id"))
    print("  name:", resp.get("name"))
    print("  schedule:", resp.get("cronSchedule"))
    print("  command:", resp.get("command"))
    print("  status:", resp.get("status"))
except urllib.error.HTTPError as e:
    print(f"✗ HTTP {e.code}: {e.read().decode()[:600]}")
